# GovBizConnect – AI NIC Code & Scheme Recommender

GovBizConnect is an AI-powered recommendation platform designed to help businesses identify relevant NIC (National Industrial Classification) codes and discover government schemes tailored to their industry and operational requirements.

The platform uses semantic search techniques powered by SBERT embeddings and FAISS vector indexing to provide intelligent recommendations beyond traditional keyword-based search. Users can describe their business activities in natural language and receive accurate classification suggestions along with relevant government schemes.

## Features

* AI-powered NIC code recommendation
* Government scheme discovery and matching
* Semantic search using SBERT embeddings
* Fast vector similarity search with FAISS
* Natural language business description analysis
* Flask-based backend APIs
* React.js frontend interface
* Intelligent recommendation workflows

## Tech Stack

### Frontend

* React.js
* JavaScript
* HTML/CSS

### Backend

* Python
* Flask

### AI & Search

* SBERT (Sentence Transformers)
* FAISS
* Semantic Search

### Data

* NIC Classification Dataset
* Government Scheme Dataset

## Architecture

```text
User Query
     │
     ▼
React Frontend
     │
     ▼
Flask API
     │
 ┌───┴───────────┐
 ▼               ▼
SBERT       NIC & Scheme
Embeddings     Datasets
     │
     ▼
FAISS Vector Search
     │
     ▼
Recommendations
```

## Project Structure

```text
.
├── app.py
├── requirements.txt
├── App.js
├── home.js
├── nic.js
├── package.json
├── nic_2008.csv
├── Cleaned_CenterSectorScheme2021-22.csv
└── README.md
```

## Workflow

1. User enters a business description.
2. Text is converted into vector embeddings using SBERT.
3. FAISS performs similarity search on NIC classifications.
4. Matching NIC codes are identified.
5. Relevant government schemes are retrieved.
6. Recommendations are displayed through the React interface.

## Key Learning Outcomes

* Natural Language Processing (NLP)
* Semantic Search Systems
* Vector Databases and Retrieval
* Recommendation Systems
* AI-powered Search Applications
* Full-Stack Development with Flask and React

## Future Improvements

* Multilingual support
* Personalized recommendations
* Advanced filtering and ranking
* Cloud deployment
* Real-time scheme updates

## Author

Ayushi Bansal

M.Sc. Chemistry + B.E. Mechanical Engineering
BITS Pilani, Hyderabad Campus
