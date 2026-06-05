import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./home";
import AppPage from "./nic.js";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/nic" element={<AppPage />} />
      </Routes>
    </Router>
  );
}

export default App;
