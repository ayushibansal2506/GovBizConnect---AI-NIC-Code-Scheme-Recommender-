import React, { useState, useEffect, useRef } from "react";
import {
  FaSearch,
  FaBuilding,
  FaRegLightbulb,
  FaLightbulb,
  FaMagic,
  FaQuestionCircle,
  FaThumbsUp,
  FaThumbsDown,
  FaExclamationTriangle,
  FaInfoCircle,
  FaRobot,
  FaHistory,
  FaMicrophone,
  FaMicrophoneSlash,
  FaCamera,
  FaImage,
  FaSpinner,
  FaFile,
} from "react-icons/fa";
import './App.css'

function Nic() {
  const [businessDesc, setBusinessDesc] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [originalInput, setOriginalInput] = useState("");
  const [grammarSuggestion, setGrammarSuggestion] = useState("");
  const [vagueSuggestions, setVagueSuggestions] = useState([]);
  const [isVague, setIsVague] = useState(false);
  const [searchHistory, setSearchHistory] = useState([]);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState({});
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [activeTab, setActiveTab] = useState("results");
  const [enhancedInput, setEnhancedInput] = useState("");
  const [showEnhancedModal, setShowEnhancedModal] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imagePredictions, setImagePredictions] = useState([]);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedNicCode, setSelectedNicCode] = useState(null); // Track selected NIC code
  const [govtSchemes, setGovtSchemes] = useState([]); // Store govt schemes
  const [schemesLoading, setSchemesLoading] = useState(false); // Loading state for schemes
  const recognitionRef = useRef(null);
  const fileInputRef = useRef(null);
  const [batchFile, setBatchFile] = useState(null);
  const [batchResults, setBatchResults] = useState([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const batchFileInputRef = useRef(null);
  // / Add this function to handle batch file selection
  const handleBatchFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Only accept .txt and .csv files
    if (!file.name.endsWith(".txt") && !file.name.endsWith(".csv")) {
      alert("Please upload a .txt or .csv file");
      return;
    }

    setBatchFile(file);
    setShowBatchModal(true);
  };

  // Add this function to trigger batch file input
  const triggerBatchFileInput = () => {
    batchFileInputRef.current.click();
  };

  // Add this function to process the batch file
  const processBatchFile = async () => {
    if (!batchFile) return;

    setBatchLoading(true);
    try {
      // Use the global FormData constructor
      const formData = new window.FormData();
      formData.append("file", batchFile);

      const response = await fetch("http://localhost:5000/batch_process", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process batch file");
      }

      const data = await response.json();
      setBatchResults(data.batch_results || []);
    } catch (error) {
      console.error("Error processing batch file:", error);
      alert("Failed to process batch file. Please try again.");
    } finally {
      setBatchLoading(false);
    }
  };
  const fetchGovtSchemes = async (nicCode) => {
    setSchemesLoading(true);
    try {
      const response = await fetch(
        `http://localhost:5000/get_relevant_schemes?nic_code=${nicCode}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch government schemes");
      }
      const data = await response.json();

      // Log the response for debugging
      console.log("Government schemes response:", data);

      // Ensure the response is an array
      if (!Array.isArray(data)) {
        throw new Error("Expected an array of government schemes");
      }

      setGovtSchemes(data);
    } catch (error) {
      console.error("Error fetching government schemes:", error);
      alert("Failed to fetch government schemes. Please try again.");
      setGovtSchemes([]); // Reset to empty array on error
    } finally {
      setSchemesLoading(false);
    }
  };

  const handleGetGovtSchemes = (nicCode) => {
    setSelectedNicCode(nicCode);
    fetchGovtSchemes(nicCode);
  };

  const renderGovtSchemes = () => {
    if (schemesLoading) {
      return (
        <div className="flex justify-center items-center p-4">
          <FaSpinner className="animate-spin text-2xl mr-2" />
          <p>Loading schemes...</p>
        </div>
      );
    }

    // Ensure govtSchemes is an array
    if (!Array.isArray(govtSchemes)) {
      return (
        <p className="text-gray-600 p-4">
          Error: Government schemes data is not in the expected format.
        </p>
      );
    }

    if (govtSchemes.length === 0) {
      return (
        <p className="text-gray-600 p-4">
          No government schemes found for this NIC code.
        </p>
      );
    }

    return (
      <div className="mt-4 space-y-2">
        {govtSchemes.map((scheme, index) => (
          <div key={index} className="bg-gray-50 p-3 rounded-lg">
            <h4 className="font-bold">{scheme.scheme_name}</h4>
            <p className="text-sm text-gray-600">
              <strong>Ministry/Department:</strong> {scheme.ministry_department}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Budget (2021-2022):</strong> {scheme.budget_estimates_2021_2022}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Actuals (2019-2020):</strong> {scheme.actuals_2019_2020}
            </p>
          </div>
        ))}
      </div>
    );
  };

  useEffect(() => {
    const savedHistory = localStorage.getItem("searchHistory");
    if (savedHistory) {
      try {
        setSearchHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Error loading search history:", e);
      }
    }

    if ("SpeechRecognition" in window || "webkitSpeechRecognition" in window) {
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;

      recognitionRef.current.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0])
          .map((result) => result.transcript)
          .join("");

        setBusinessDesc(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        if (isListening) {
          recognitionRef.current.start();
        }
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (searchHistory.length > 0) {
      localStorage.setItem("searchHistory", JSON.stringify(searchHistory));
    }
  }, [searchHistory]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in your browser.");
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedImage(file);

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
      setShowImageModal(true);
    };
    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const processImage = async () => {
    if (!selectedImage) return;

    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append("image", selectedImage);

      const response = await fetch("http://localhost:5000/analyze_image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to analyze image");
      }

      const data = await response.json();
      setImagePredictions(data.predictions || []);
      setBusinessDesc(data.suggested_description || "");
      setShowImageModal(false);
    } catch (error) {
      console.error("Error processing image:", error);
      alert("Failed to analyze image. Please try again.");
    } finally {
      setImageLoading(false);
    }
  };

  const enhanceBusinessDescription = async (rawInput) => {
    if (!rawInput.trim()) return "";

    try {
      const prompt = `
You are an AI assistant specialized in interpreting business descriptions and mapping them to standardized industry classifications. Your task is to analyze the given business description, understand the underlying context and activities, and rewrite it in a clear, structured format suitable for classification into NIC (National Industrial Classification) codes.

Guidelines:

Interpret vague or general descriptions, inferring the most likely specific activities.

Use precise, industry-standard terminology where appropriate.

Break down complex businesses into their core components or activities.

Provide enough detail to distinguish between similar but distinct categories.

Focus on the primary business activities, not ancillary operations.

Maintain accuracy while making the description more specific and classifiable.

Rewrite the following business description in a clear, structured format optimized for NIC code classification. Return ONLY the refined business description without any additional explanations or commentary.

Business description: "${rawInput}"
`;
      console.log("Prompt for Gemini API:", prompt);
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": process.env.REACT_APP_API_KEY, // Replace with your actual API key
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2, // Lower temperature for more focused output
              maxOutputTokens: 100, // Limit output length
            },
          }),
        }
      );

      const data = await response.json();

      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const enhancedDescription =
          data.candidates[0].content.parts[0].text.trim();
        console.log("Enhanced description:", enhancedDescription);
        return enhancedDescription;
      } else {
        console.error("Unexpected Gemini API response format:", data);
        return rawInput; // Fall back to original input
      }
    } catch (error) {
      console.error("Error enhancing business description:", error);
      return rawInput; // Fall back to original input on error
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const query = businessDesc.trim();
    if (!query) {
      alert("Please describe your business activity");
      return;
    }

    setLoading(true);
    setShowResults(false);
    setIsVague(false);
    setVagueSuggestions([]);
    setFeedbackSubmitted({});

    try {
      const enhancedQuery = await enhanceBusinessDescription(query);
      const originalQuery = query;

      if (enhancedQuery !== query && enhancedQuery.trim() !== "") {
        setGrammarSuggestion(enhancedQuery);
      }

      const queryToUse = enhancedQuery.trim() !== "" ? enhancedQuery : query;

      const response = await fetch("http://localhost:5000/get_nic_codes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: queryToUse,
          original_input: originalQuery,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch results");
      }

      const data = await response.json();
      setResults(data.results);
      setSuggestions(data.suggestions || []);
      setOriginalInput(data.original_input);

      if (
        !grammarSuggestion &&
        data.corrected_input &&
        data.corrected_input !== queryToUse
      ) {
        setGrammarSuggestion(data.corrected_input);
      }

      if (data.is_vague) {
        setIsVague(true);
        setVagueSuggestions(data.vague_suggestions || []);
      }

      if (data.results.length > 0) {
        const newSearch = {
          query: query,
          timestamp: new Date().toISOString(),
          topResult: data.results[0]?.nic_code,
        };

        setSearchHistory((prev) => {
          const updated = [
            newSearch,
            ...prev.filter((item) => item.query !== query),
          ].slice(0, 10);
          return updated;
        });
      }

      setShowResults(true);
      setActiveTab("results");
    } catch (error) {
      console.error("Error:", error);
      alert("Something went wrong. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setBusinessDesc(suggestion);
  };

  const applyGrammarCorrection = () => {
    setBusinessDesc(grammarSuggestion);
    setGrammarSuggestion("");
  };

  const handleVagueSuggestionClick = (suggestion) => {
    setBusinessDesc((prev) => {
      if (prev.trim() === "") {
        return suggestion;
      } else {
        return `${prev} (${suggestion})`;
      }
    });
  };

  const handleHistoryItemClick = (historyItem) => {
    setBusinessDesc(historyItem.query);
  };

  const submitFeedback = async (resultId, isPositive) => {
    if (feedbackSubmitted[resultId] !== undefined) {
      return;
    }

    try {
      await fetch("http://localhost:5000/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          original_query: originalInput,
          nic_code: results[resultId].nic_code,
          is_positive: isPositive,
        }),
      });

      setFeedbackSubmitted((prev) => ({
        ...prev,
        [resultId]: isPositive,
      }));
    } catch (error) {
      console.error("Error submitting feedback:", error);
    }
  };

  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem("searchHistory");
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {showInfoModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4 flex items-center">
              About NIC Code Finder <FaInfoCircle className="ml-2" />
            </h2>
            <p className="mb-4">
              The National Industrial Classification (NIC) code is a statistical
              standard for organizing economic data. This tool helps you find
              the appropriate NIC code for your business activities.
            </p>
            <h3 className="font-bold mb-2">Tips for better results:</h3>
            <ul className="list-disc list-inside mb-4">
              <li>Be specific about your business activities</li>
              <li>Include key products or services you provide</li>
              <li>Mention manufacturing processes or methods if applicable</li>
              <li>Use industry-specific terminology when possible</li>
              <li>
                You can now use the microphone icon to dictate your business
                description
              </li>
              <li>
                Try the new image upload feature to analyze products in your
                business
              </li>
            </ul>
            <button
              onClick={() => setShowInfoModal(false)}
              className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
            <h2 className="text-2xl font-bold mb-4 flex items-center">
              <FaImage className="mr-2" /> Image Analysis
            </h2>
            <div className="mb-4 flex justify-center items-center"> {/* Center the image */}
              {imagePreview && (
                <img
                  src={imagePreview}
                  alt="Uploaded business"
                  className="max-w-full max-h-96 object-contain rounded" // Set max height to 96 (24rem)
                />
              )}
            </div>
            <p className="mb-4">
              Upload a photo of your business or products to help identify the
              appropriate NIC code.
            </p>
            {imageLoading ? (
              <div className="flex flex-col items-center">
                <FaSpinner className="animate-spin text-2xl mb-2" />
                <p>Analyzing image...</p>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowImageModal(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={processImage}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                >
                  Analyze Image
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="py-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-3xl font-bold flex items-center">
              <FaBuilding className="mr-2" /> NIC Code Finder
            </h1>
            <button
              onClick={() => setShowInfoModal(true)}
              className="text-gray-600 hover:text-gray-800"
            >
              <FaQuestionCircle className="text-2xl" />
            </button>
          </div>
          <p className="text-gray-600">
            Find the perfect National Industrial Classification code for your
            business activities
          </p>
        </header>

        <main className="mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            {grammarSuggestion && (
              <div className="bg-yellow-50 p-4 rounded-md mb-4 flex items-center">
                <FaMagic className="text-yellow-500 mr-2" />
                <span className="flex-1">
                  <strong>Did you mean:</strong> {grammarSuggestion}
                </span>
                <button
                  onClick={applyGrammarCorrection}
                  className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                >
                  Apply
                </button>
              </div>
            )}

            {enhancedInput && enhancedInput !== businessDesc && (
              <div className="bg-blue-50 p-4 rounded-md mb-4 flex items-center">
                <FaRobot className="text-blue-500 mr-2" />
                <span className="flex-1">
                  <strong>AI-Enhanced:</strong> Your query was processed with
                  Gemini AI to improve results
                </span>
                <button
                  onClick={() => setShowEnhancedModal(true)}
                  className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
                >
                  View Enhanced Query
                </button>
              </div>
            )}

            {showEnhancedModal && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-lg p-6 max-w-2xl w-full">
                  <h2 className="text-2xl font-bold mb-4 flex items-center">
                    <FaRobot className="mr-2" /> AI-Enhanced Query
                  </h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="font-bold mb-2">
                        Your Original Description:
                      </h3>
                      <p className="bg-gray-50 p-3 rounded">
                        {originalInput}
                      </p>
                    </div>
                    <div>
                      <h3 className="font-bold mb-2">
                        AI-Enhanced Description:
                      </h3>
                      <p className="bg-blue-50 p-3 rounded">
                        {enhancedInput}
                      </p>
                    </div>
                  </div>
                  <p className="text-gray-600 mb-4">
                    Gemini AI analyzed your business description and extracted
                    the most relevant industry terms and activities to improve
                    your NIC code matching results.
                  </p>
                  <button
                    onClick={() => setShowEnhancedModal(false)}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="businessDesc"
                  className="block font-medium mb-2 flex items-center"
                >
                  <FaRegLightbulb className="mr-2" />
                  Describe your business activity
                </label>
                <div className="relative">
                  <textarea
                    id="businessDesc"
                    value={businessDesc}
                    onChange={(e) => setBusinessDesc(e.target.value)}
                    placeholder="e.g. Manufacture of mineral water, Production of cement, Software development services"
                    rows="3"
                    className="w-full p-2 border rounded-md pr-12"
                  />
                  <div className="absolute right-2 top-2 flex flex-col gap-1">
                    <button
                      type="button"
                      onClick={toggleListening}
                      className={`p-2 rounded-full ${isListening
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 hover:bg-gray-300"
                        }`}
                      title={isListening ? "Stop listening" : "Start voice input"}
                    >
                      {isListening ? (
                        <FaMicrophone className="text-sm" />
                      ) : (
                        <FaMicrophoneSlash className="text-sm" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={triggerFileInput}
                      className="p-2 bg-gray-200 rounded-full hover:bg-gray-300"
                      title="Upload business image"
                    >
                      <FaCamera className="text-sm" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>
                </div>
                {isListening && (
                  <div className="mt-2 text-sm text-gray-600 flex items-center">
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse mr-2"></span>
                    Listening... speak now
                  </div>
                )}
              </div>

              {isVague && vagueSuggestions.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-md mb-4">
                  <h4 className="font-bold mb-2 flex items-center">
                    <FaExclamationTriangle className="mr-2" /> Your description
                    is a bit general
                  </h4>
                  <p className="mb-2">
                    Try adding more details or select a specific industry:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {vagueSuggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleVagueSuggestionClick(suggestion)}
                        className="bg-yellow-100 px-3 py-1 rounded-full text-sm hover:bg-yellow-200"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {suggestions.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-bold mb-2 flex items-center">
                    <FaLightbulb className="mr-2" /> Expanded Search Terms
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.map((suggestion, index) => (
                      <span
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="bg-blue-100 px-3 py-1 rounded-full text-sm cursor-pointer hover:bg-blue-200"
                      >
                        {suggestion}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 flex items-center justify-center"
              >
                <FaSearch className="mr-2" />
                Find NIC Codes
              </button>
            </form>
          </div>

          {loading && (
            <div className="mt-8 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2">Analyzing your business description...</p>
              <p className="text-gray-600 mt-1 flex items-center justify-center">
                <FaRobot className="mr-2" /> AI is processing industry-specific
                terms and patterns
              </p>
            </div>
          )}

          {showResults && (
            <div className="mt-8">
              <div className="flex border-b mb-4">
                <button
                  className={`px-4 py-2 ${activeTab === "results"
                    ? "border-blue-500 text-blue-500 border-b-2"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                  onClick={() => setActiveTab("results")}
                >
                  Results
                </button>
                <button
                  className={`px-4 py-2 flex items-center ${activeTab === "history"
                    ? "border-blue-500 text-blue-500 border-b-2"
                    : "text-gray-500 hover:text-gray-700"
                    }`}
                  onClick={() => setActiveTab("history")}
                >
                  <FaHistory className="mr-2" /> Search History
                </button>
              </div>

              {activeTab === "results" && (
                <div>
                  <h2 className="text-2xl font-bold mb-4">
                    Top NIC Code Suggestions:
                  </h2>
                  {results.length === 0 ? (
                    <div className="bg-yellow-50 p-4 rounded-md flex items-center">
                      <FaExclamationTriangle className="text-yellow-500 mr-2" />
                      <p>
                        No matching NIC codes found. Try adding more specific
                        details about your business activities.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.map((result, index) => (
                        <div
                          key={index}
                          className="bg-white rounded-lg shadow p-4"
                        >
                          <div className="flex justify-between items-center mb-2">
                            <h3 className="font-bold">
                              NIC Code: {result.nic_code}
                            </h3>
                            <span
                              className={`px-2 py-1 rounded-full text-sm ${result.similarity_score > 0.7
                                ? "bg-green-100 text-green-700"
                                : result.similarity_score > 0.4
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-red-100 text-red-700"
                                }`}
                            >
                              Match {(result.similarity_score * 100).toFixed(1)}%
                            </span>
                          </div>
                          <p className="text-gray-600 mb-2">
                            {result.description}
                          </p>
                          <div className="text-sm text-gray-500 space-y-1">
                            <p>
                              <strong>Division:</strong> {result.division}
                            </p>
                            <p>
                              <strong>Section:</strong> {result.section}
                            </p>
                          </div>
                          <button
                            onClick={() => handleGetGovtSchemes(result.nic_code)}
                            className="mt-4 w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 flex items-center justify-center"
                          >
                            Get Govt. Schemes
                          </button>

                          {/* Display government schemes if this NIC code is selected */}
                          {selectedNicCode === result.nic_code && renderGovtSchemes()}
                          <div className="mt-4">
                            <p className="text-sm mb-1">Was this helpful?</p>
                            <div className="flex gap-2">
                              <button
                                className={`p-1 rounded ${feedbackSubmitted[index] === true
                                  ? "bg-green-500 text-white"
                                  : "bg-gray-200 hover:bg-gray-300"
                                  }`}
                                onClick={() => submitFeedback(index, true)}
                                disabled={
                                  feedbackSubmitted[index] !== undefined
                                }
                              >
                                <FaThumbsUp />
                              </button>
                              <button
                                className={`p-1 rounded ${feedbackSubmitted[index] === false
                                  ? "bg-red-500 text-white"
                                  : "bg-gray-200 hover:bg-gray-300"
                                  }`}
                                onClick={() => submitFeedback(index, false)}
                                disabled={
                                  feedbackSubmitted[index] !== undefined
                                }
                              >
                                <FaThumbsDown />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "history" && (
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold">Your Recent Searches</h2>
                    {searchHistory.length > 0 && (
                      <button
                        onClick={clearHistory}
                        className="text-red-500 hover:text-red-700"
                      >
                        Clear History
                      </button>
                    )}
                  </div>
                  {searchHistory.length === 0 ? (
                    <p className="text-gray-600">No search history yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {searchHistory.map((item, index) => (
                        <div
                          key={index}
                          onClick={() => handleHistoryItemClick(item)}
                          className="bg-white p-3 rounded-lg shadow cursor-pointer hover:bg-gray-50"
                        >
                          <p className="font-medium">{item.query}</p>
                          <div className="text-sm text-gray-500 flex justify-between">
                            <span>
                              {new Date(item.timestamp).toLocaleDateString()}
                            </span>
                            <span>NIC: {item.topResult}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="py-4 text-center text-gray-600 border-t mt-8">
          <p>© 2025 NIC Code Finder | Powered by AI Technology</p>
        </footer>
      </div>
    </div>
  );
}

export default Nic;