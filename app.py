from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import numpy as np
import re
import logging
import time
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import torch
import tensorflow as tf
from tensorflow.keras.applications.resnet50 import ResNet50, preprocess_input, decode_predictions
from concurrent.futures import ThreadPoolExecutor
import os
from PIL import Image
import io
import base64
import threading
from functools import lru_cache

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global variables with thread locks for safe initialization
_image_model_lock = threading.Lock()
_processor_lock = threading.Lock()
_govt_schemes_lock = threading.Lock()

# Image processing model with lazy initialization
image_model = None

def get_image_model():
    global image_model
    with _image_model_lock:
        if image_model is None:
            try:
                logger.info("Initializing ResNet50 model")
                image_model = ResNet50(weights='imagenet')
                logger.info("ResNet50 model initialized successfully")
            except Exception as e:
                logger.error(f"Error initializing image model: {str(e)}")
                return None
    return image_model

def preprocess_image(image_data):
    try:
        # Convert base64 to image
        img = Image.open(io.BytesIO(image_data))
        img = img.convert("RGB")
        img = img.resize((224, 224))
        img = np.array(img)
        img = np.expand_dims(img, axis=0)
        img = preprocess_input(img)
        return img
    except Exception as e:
        logger.error(f"Error preprocessing image: {str(e)}")
        return None

def predict_items(image_data):
    model = get_image_model()
    if model is None:
        return []
    
    img = preprocess_image(image_data)
    if img is None:
        return []
    
    preds = model.predict(img)
    decoded_preds = decode_predictions(preds, top=5)[0]
    return [(label, float(prob)) for (_, label, prob) in decoded_preds]

class SemanticNICCodeProcessor:
    def __init__(self, csv_path):
        logger.info("Initializing Semantic NIC Code Processor")
        
        # Load CSV with efficient dtype specifications
        start_time = time.time()
        try:
            # Use more efficient dtypes and only load necessary columns
            self.df = pd.read_csv(csv_path, dtype={
                'Sub Class': 'int32',
                'Description': 'string', 
                'Division': 'string', 
                'Section': 'string'
            })
            logger.info(f"CSV loaded in {time.time() - start_time:.2f} seconds. Total rows: {len(self.df)}")
        except Exception as e:
            logger.error(f"Error loading CSV: {str(e)}")
            raise
        
        # Load pre-trained semantic search model
        try:
            # Use a more efficient model variant
            self.semantic_model = SentenceTransformer('all-MiniLM-L6-v2')
            logger.info("Sentence Transformer model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading semantic model: {str(e)}")
            raise
        
        # Create a dictionary lookup for NIC codes for faster retrieval
        self.nic_code_lookup = {code: idx for idx, code in enumerate(self.df['Sub Class'])}
        
        # Create combined descriptions for richer embedding
        self.combined_descriptions = (
            self.df['Description'] + ' ' + 
            self.df['Division'] + ' ' + 
            self.df['Section']
        ).tolist()
        
        # Precompute embeddings for all descriptions
        self.precompute_embeddings()
        
        # Advanced query cache with LRU mechanism
        self.max_cache_size = 500
        self.query_cache = {}
        
        # Index creation for faster lookup
        start_time = time.time()
        try:
            from sklearn.neighbors import NearestNeighbors
            # Use approximate nearest neighbors for faster search
            self.nn_index = NearestNeighbors(
                n_neighbors=20,
                algorithm='ball_tree',
                metric='cosine'
            )
            # Convert to numpy for faster operations
            embeddings_np = self.description_embeddings.cpu().numpy()
            self.nn_index.fit(embeddings_np)
            logger.info(f"Nearest neighbors index created in {time.time() - start_time:.2f} seconds")
        except Exception as e:
            logger.error(f"Error creating nearest neighbors index: {str(e)}")
            self.nn_index = None
    
    def precompute_embeddings(self):
        """Precompute embeddings for all NIC code descriptions with batching"""
        logger.info("Precomputing embeddings for NIC code descriptions")
        start_time = time.time()
        
        # Use batching for more efficient memory usage and potential parallelization
        batch_size = 128
        num_items = len(self.combined_descriptions)
        batches = [self.combined_descriptions[i:i+batch_size] for i in range(0, num_items, batch_size)]
        
        # Allocate tensor to store all embeddings
        first_batch_embedding = self.semantic_model.encode(batches[0], convert_to_tensor=True)
        embedding_dim = first_batch_embedding.shape[1]
        
        # Pre-allocate the tensor for all embeddings
        if torch.cuda.is_available():
            device = torch.device('cuda')
            self.description_embeddings = torch.zeros((num_items, embedding_dim), device=device)
        else:
            self.description_embeddings = torch.zeros((num_items, embedding_dim))
        
        # Copy first batch embeddings
        self.description_embeddings[:len(batches[0])] = first_batch_embedding
        
        # Process remaining batches
        current_idx = len(batches[0])
        for i, batch in enumerate(batches[1:], 1):
            batch_embedding = self.semantic_model.encode(
                batch, 
                convert_to_tensor=True,
                show_progress_bar=False
            )
            end_idx = current_idx + len(batch)
            self.description_embeddings[current_idx:end_idx] = batch_embedding
            current_idx = end_idx
            
            # Log progress periodically
            if i % 5 == 0 or i == len(batches) - 1:
                logger.info(f"Processed {current_idx}/{num_items} embeddings")
        
        logger.info(f"All embeddings computed in {time.time() - start_time:.2f} seconds")
    
    @lru_cache(maxsize=100)
    def encode_query(self, query):
        """Cache query encodings to avoid recomputing for repeated queries"""
        return self.semantic_model.encode(query, convert_to_tensor=True)
    
    def find_nic_codes(self, query, top_n=5):
        """Find NIC codes using optimized semantic search"""
        logger.info(f"Processing query: {query}")
        start_time = time.time()
        
        # Check cache first (case-insensitive and whitespace normalized)
        cache_key = query.lower().strip()
        if cache_key in self.query_cache:
            logger.info("Using cached result")
            return self.query_cache[cache_key]
        
        # Encode query (with caching through the lru_cache decorator)
        query_embedding = self.encode_query(cache_key)
        
        # Use nearest neighbors for faster search if available
        if self.nn_index is not None:
            # Convert to numpy for NN search
            query_np = query_embedding.cpu().numpy().reshape(1, -1)
            # Get distances and indices of nearest neighbors
            distances, indices = self.nn_index.kneighbors(query_np)
            # Convert distances to similarity scores (cosine distance to similarity)
            similarities = 1 - distances[0]
            top_indices = indices[0]
        else:
            # Fall back to original method if NN index not available
            similarities = cosine_similarity(
                query_embedding.cpu().numpy().reshape(1, -1), 
                self.description_embeddings.cpu().numpy()
            )[0]
            top_indices = np.argsort(similarities)[-top_n:][::-1]
        
        results = []
        min_threshold = 0.15  # Slightly increased threshold for better quality matches
        
        # Create results array - only process indices with similarity above threshold
        filtered_indices = [idx for idx, sim in zip(top_indices, similarities) if sim > min_threshold]
        for idx in filtered_indices[:top_n]:  # Limit to top_n results
            results.append({
                'nic_code': int(self.df.iloc[idx]['Sub Class']),
                'description': self.df.iloc[idx]['Description'],
                'division': self.df.iloc[idx]['Division'],
                'section': self.df.iloc[idx]['Section'],
                'similarity_score': float(similarities[idx if self.nn_index else idx])
            })
        
        # Prepare response
        response = {
            'results': results,
            'query': query,
            'total_matches': len(results),
            'processing_time_ms': int((time.time() - start_time) * 1000)
        }
        
        # Cache management - LRU implementation
        if len(self.query_cache) >= self.max_cache_size:
            # Remove oldest item (first inserted)
            self.query_cache.pop(next(iter(self.query_cache)))
        self.query_cache[cache_key] = response
        
        logger.info(f"Found {len(results)} results in {time.time() - start_time:.4f} seconds")
        return response

# Global processor with thread-safe lazy initialization
nic_processor = None
govt_schemes_df = None
govt_schemes_by_category = None  # For faster scheme lookup

def get_processor():
    global nic_processor
    with _processor_lock:
        if nic_processor is None:
            try:
                logger.info("Initializing Semantic NIC processor")
                nic_processor = SemanticNICCodeProcessor('nic_2008.csv')
                logger.info("Semantic NIC processor initialized successfully")
            except Exception as e:
                logger.error(f"Error initializing processor: {str(e)}")
                return None
    return nic_processor

def get_govt_schemes():
    global govt_schemes_df, govt_schemes_by_category
    with _govt_schemes_lock:
        if govt_schemes_df is None:
            try:
                logger.info("Loading government schemes CSV")
                govt_schemes_df = pd.read_csv('Cleaned_CenterSectorScheme2021-22 (1).csv')
                
                # Create an optimized lookup dictionary for faster scheme retrieval
                govt_schemes_by_category = {}
                for _, row in govt_schemes_df.iterrows():
                    if pd.notna(row['Category']):
                        categories = str(row['Category']).split(',')
                        for cat in categories:
                            cat = cat.strip()
                            if cat not in govt_schemes_by_category:
                                govt_schemes_by_category[cat] = []
                            govt_schemes_by_category[cat].append(row)
                
                logger.info("Government schemes CSV loaded and indexed successfully")
            except Exception as e:
                logger.error(f"Error loading government schemes CSV: {str(e)}")
                return None
    return govt_schemes_df

# Cache for scheme recommendations to avoid repeated computation
scheme_recommendation_cache = {}
MAX_SCHEME_CACHE_SIZE = 100

def get_relevant_schemes(nic_code, description=None):
    """Fetch relevant government schemes based on NIC code and description using semantic similarity"""
    # Check cache first
    cache_key = f"{nic_code}_{description if description else ''}"
    if cache_key in scheme_recommendation_cache:
        return scheme_recommendation_cache[cache_key]
    
    schemes_df = get_govt_schemes()
    processor = get_processor()
    
    if schemes_df is None or processor is None:
        logger.error("Government schemes dataframe or processor is None")
        return []
    
    # If no description provided, try to find it based on NIC code
    if description is None:
        try:
            # Use the lookup dictionary for fast access
            nic_code_int = int(nic_code)
            if nic_code_int in processor.nic_code_lookup:
                idx = processor.nic_code_lookup[nic_code_int]
                row = processor.df.iloc[idx]
                description = f"{row['Description']} {row['Division']} {row['Section']}"
                logger.info(f"Found description for NIC code {nic_code}: {description}")
            else:
                logger.warning(f"No description found for NIC code {nic_code}")
                # Fall back to the original method
                schemes = get_relevant_schemes_by_code(nic_code)
                # Cache the result
                if len(scheme_recommendation_cache) >= MAX_SCHEME_CACHE_SIZE:
                    scheme_recommendation_cache.pop(next(iter(scheme_recommendation_cache)))
                scheme_recommendation_cache[cache_key] = schemes
                return schemes
        except Exception as e:
            logger.error(f"Error finding description for NIC code: {str(e)}")
            schemes = get_relevant_schemes_by_code(nic_code)
            # Cache the result
            if len(scheme_recommendation_cache) >= MAX_SCHEME_CACHE_SIZE:
                scheme_recommendation_cache.pop(next(iter(scheme_recommendation_cache)))
            scheme_recommendation_cache[cache_key] = schemes
            return schemes
    
    # Use semantic search to find relevant schemes
    logger.info(f"Finding schemes relevant to description: {description}")
    
    start_time = time.time()
    # Get embeddings for the description
    query_embedding = processor.semantic_model.encode(description, convert_to_tensor=True)
    
    # Instead of encoding all schemes at once, we'll use batching
    scheme_names = schemes_df['Scheme'].fillna('').tolist()
    
    # Use efficient batching for scheme embeddings
    batch_size = 128
    num_schemes = len(scheme_names)
    similarities = np.zeros(num_schemes)
    
    for i in range(0, num_schemes, batch_size):
        end_idx = min(i + batch_size, num_schemes)
        batch = scheme_names[i:end_idx]
        
        # Encode this batch
        batch_embeddings = processor.semantic_model.encode(batch, convert_to_tensor=True)
        
        # Calculate similarities for this batch
        batch_similarities = cosine_similarity(
            query_embedding.cpu().numpy().reshape(1, -1), 
            batch_embeddings.cpu().numpy()
        )[0]
        
        # Store in our similarities array
        similarities[i:end_idx] = batch_similarities
    
    # Find top matches (schemes with similarity above threshold)
    similarity_threshold = 0.3  # Adjust based on testing
    top_n = 10
    
    # Get indices of top N similarities
    top_indices = np.argsort(similarities)[-top_n:][::-1]
    # Filter by threshold
    top_indices = [idx for idx in top_indices if similarities[idx] > similarity_threshold]
    
    logger.info(f"Found {len(top_indices)} semantically relevant schemes in {time.time() - start_time:.4f} seconds")
    
    # Prepare the response
    schemes_list = []
    for idx in top_indices:
        row = schemes_df.iloc[idx]
        scheme_data = {
            'scheme_name': row['Scheme'],
            'ministry_department': row['Ministry/Department'],
            'budget_estimates_2021_2022': row['Budget Estimates2021-2022 - Total'],
            'actuals_2019_2020': row['Actuals2019-2020 - Total'],
            'similarity_score': float(similarities[idx])
        }
        schemes_list.append(scheme_data)
    
    # If no relevant schemes found by semantic search, try the original method
    if not schemes_list:
        logger.info("No schemes found by semantic search, falling back to code matching")
        schemes_list = get_relevant_schemes_by_code(nic_code)
    
    # Cache the result
    if len(scheme_recommendation_cache) >= MAX_SCHEME_CACHE_SIZE:
        scheme_recommendation_cache.pop(next(iter(scheme_recommendation_cache)))
    scheme_recommendation_cache[cache_key] = schemes_list
    
    return schemes_list

def get_relevant_schemes_by_code(nic_code):
    """Optimized method to fetch relevant government schemes based on NIC code"""
    global govt_schemes_by_category
    
    if govt_schemes_by_category is None:
        # Initialize if not already done
        get_govt_schemes()
        if govt_schemes_by_category is None:
            return []
    
    # Convert NIC code to string for comparison
    nic_code_str = str(nic_code)
    
    # Check if this NIC code exists in our preprocessed dictionary
    if nic_code_str in govt_schemes_by_category:
        relevant_rows = govt_schemes_by_category[nic_code_str]
        
        # Prepare the response
        schemes_list = []
        for row in relevant_rows:
            scheme_data = {
                'scheme_name': row['Scheme'],
                'ministry_department': row['Ministry/Department'],
                'budget_estimates_2021_2022': row['Budget Estimates2021-2022 - Total'],
                'actuals_2019_2020': row['Actuals2019-2020 - Total']
            }
            schemes_list.append(scheme_data)
        
        return schemes_list
    
    return []

@app.route('/analyze_image', methods=['POST'])
def analyze_image():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        # Load and process image
        image_file = request.files['image']
        image_data = image_file.read()
        
        # Run image analysis
        predictions = predict_items(image_data)
        
        if not predictions:
            return jsonify({'error': 'Could not process image or no predictions found'}), 400
        
        # Generate a description from the predicted items
        item_descriptions = [f"{label} ({prob*100:.1f}%)" for label, prob in predictions]
        business_description = "Business dealing with " + ", ".join(item_descriptions[:3])
        
        return jsonify({
            'predictions': [{'label': label, 'probability': prob} for label, prob in predictions],
            'suggested_description': business_description
        })
    
    except Exception as e:
        logger.error(f"Error analyzing image: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/get_nic_codes', methods=['POST'])
def get_nic_codes():
    start_time = time.time()
    try:
        # Lazy initialization of processor
        processor = get_processor()
        if processor is None:
            return jsonify({
                'error': 'NIC Code Processor failed to initialize. Check server logs.',
                'results': []
            }), 500
        
        # Get input
        user_input = request.json.get('input', '')
        original_input = request.json.get('original_input', user_input)
        
        logger.info(f"Received request for: {user_input}")
        
        # Find NIC codes
        result_data = processor.find_nic_codes(user_input)
        
        # Start a thread pool for parallel scheme retrieval
        from concurrent.futures import ThreadPoolExecutor
        
        def get_schemes_for_result(result):
            nic_code = result['nic_code']
            relevant_schemes = get_relevant_schemes(nic_code, result['description'])
            result['relevant_schemes'] = relevant_schemes
            return result
        
        # Use thread pool to parallelize scheme retrieval
        with ThreadPoolExecutor(max_workers=min(10, len(result_data['results']))) as executor:
            updated_results = list(executor.map(get_schemes_for_result, result_data['results']))
        
        # Replace results with updated ones that include schemes
        result_data['results'] = updated_results
        
        # Add performance metrics
        result_data['total_processing_time_ms'] = int((time.time() - start_time) * 1000)
        
        return jsonify({
            'results': result_data['results'],
            'total_matches': result_data['total_matches'],
            'original_input': original_input,
            'enhanced_input': user_input if user_input != original_input else None,
            'processing_time_ms': result_data['total_processing_time_ms']
        })
    
    except Exception as e:
        logger.error(f"Error processing request: {str(e)}")
        return jsonify({
            'error': str(e),
            'results': [],
            'processing_time_ms': int((time.time() - start_time) * 1000)
        }), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok', 
        'processor_initialized': get_processor() is not None,
        'image_model_initialized': get_image_model() is not None,
        'govt_schemes_loaded': get_govt_schemes() is not None,
        'memory_usage_mb': get_memory_usage()
    })

def get_memory_usage():
    """Get current memory usage of the process"""
    try:
        import psutil
        import os
        process = psutil.Process(os.getpid())
        memory_info = process.memory_info()
        return memory_info.rss / (1024 * 1024)  # Convert to MB
    except ImportError:
        return -1  # psutil not available
@app.route('/batch_process', methods=['POST'])
def batch_process():
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        
        # Check if file is empty
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        # Check if file is a text file
        if not file.filename.endswith(('.txt', '.csv')):
            return jsonify({'error': 'Only .txt and .csv files are supported'}), 400
            
        # Process the file content
        content = file.read().decode('utf-8')
        
        # Split content by new lines, filtering out empty lines
        descriptions = [line.strip() for line in content.splitlines() if line.strip()]
        
        logger.info(f"Batch processing {len(descriptions)} descriptions")
        
        # Get processor
        processor = get_processor()
        if processor is None:
            return jsonify({
                'error': 'NIC Code Processor failed to initialize. Check server logs.',
                'results': []
            }), 500
        
        # Process descriptions in parallel using thread pool
        batch_results = []
        
        # Use ThreadPoolExecutor with a reasonable number of workers
        with ThreadPoolExecutor(max_workers=min(4, len(descriptions))) as executor:
            # Submit all tasks to the executor
            futures = [executor.submit(processor.find_nic_codes, desc) for desc in descriptions]
            
            # Collect results as they complete
            for future, desc in zip(futures, descriptions):
                try:
                    result_data = future.result()
                    batch_results.append({
                        'description': desc,
                        'results': result_data['results'],
                        'total_matches': result_data['total_matches']
                    })
                except Exception as e:
                    logger.error(f"Error processing description '{desc}': {str(e)}")
                    batch_results.append({
                        'description': desc,
                        'results': [],
                        'total_matches': 0,
                        'error': str(e)
                    })
        
        logger.info(f"Completed batch processing. Total processed: {len(batch_results)}")
        
        return jsonify({
            'batch_results': batch_results,
            'total_processed': len(batch_results)
        })
    
    except Exception as e:
        logger.error(f"Error processing batch file: {str(e)}")
        return jsonify({
            'error': str(e),
            'results': []
        }), 500
@app.route('/feedback', methods=['POST'])
def collect_feedback():
    """Collect user feedback on NIC code matches"""
    try:
        feedback_data = request.json
        logger.info(f"Received feedback: {feedback_data}")
        
        # Placeholder for feedback collection logic
        return jsonify({'status': 'feedback received'})
    except Exception as e:
        logger.error(f"Error processing feedback: {str(e)}")
        return jsonify({'error': str(e)}), 500
    
@app.route('/get_relevant_schemes', methods=['GET'])
def get_relevant_schemes_endpoint():
    try:
        # Get NIC code from query parameters
        nic_code = request.args.get('nic_code')
        description = request.args.get('description')
        
        if not nic_code:
            return jsonify({'error': 'NIC code is required'}), 400
        
        # Fetch relevant schemes with semantic similarity if description is provided
        schemes = get_relevant_schemes(nic_code, description)
        
        # Ensure the response is always an array
        if not schemes:
            return jsonify([])
        
        return jsonify(schemes)
    except Exception as e:
        logger.error(f"Error fetching government schemes: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask application")
    
    # Pre-initialize processor and models in separate threads
    threading.Thread(target=get_processor, daemon=True).start()
    threading.Thread(target=get_image_model, daemon=True).start()
    threading.Thread(target=get_govt_schemes, daemon=True).start()
    
    # Use production server for better performance
    from waitress import serve
    logger.info("Starting Waitress server on port 5000")
    serve(app, host='0.0.0.0', port=5000, threads=8)
    
    # Or use Flask's development server
    # app.run(debug=False, host='0.0.0.0', port=5000, threaded=True)