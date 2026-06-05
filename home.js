import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import "./home.css";
import logo from './images/logo.svg';

function Home() {
    const navigate = useNavigate();
    const [text, setText] = useState("");
    const [isTyping, setIsTyping] = useState(true);
    const fullText = "Welcome to the future of technology and innovation. Experience the next level.";
    const typingSpeed = 50;
    const cursorRef = useRef(null);

    // Typewriter effect
    useEffect(() => {
        if (isTyping && text.length < fullText.length) {
            const timeout = setTimeout(() => {
                setText(fullText.slice(0, text.length + 1));
            }, typingSpeed);
            return () => clearTimeout(timeout);
        } else if (text.length === fullText.length) {
            setIsTyping(false);
            setTimeout(() => setIsTyping(true), 5000);
        } else if (!isTyping && text.length > 0) {
            const timeout = setTimeout(() => {
                setText(text.slice(0, text.length - 1));
            }, typingSpeed / 2);
            return () => clearTimeout(timeout);
        } else if (!isTyping && text.length === 0) {
            setIsTyping(true);
        }
    }, [text, isTyping]);

    // Cursor blinking effect
    useEffect(() => {
        const cursor = cursorRef.current;
        if (!cursor) return;

        const blinkInterval = setInterval(() => {
            cursor.style.opacity = cursor.style.opacity === "0" ? "1" : "0";
        }, 500);

        return () => clearInterval(blinkInterval);
    }, []);

    return (
        <div className="main-container">
            {/* Logo - Static version */}
            <div className="logo-container">
                <img src={logo} alt="Logo" className="logo" />
            </div>

            {/* Aurora Title */}
            <div className="content">
                <h1 className="title">
                    GovBizConnect
                    <div className="aurora">
                        <div className="aurora__item"></div>
                        <div className="aurora__item"></div>
                        <div className="aurora__item"></div>
                        <div className="aurora__item"></div>
                    </div>
                </h1>
            </div>

            {/* Typewriter Text */}
            <div className="typewriter-container">
                <p className="typewriter-text">
                    {text}
                    <span ref={cursorRef} className="cursor">|</span>
                </p>
            </div>

            {/* Animated Button */}
            <motion.button
                className="animated-button"
                onClick={() => navigate("/nic")}
                whileHover={{
                    scale: 1.05,
                    boxShadow: "0 0 15px #00c2ff, 0 0 30px rgba(51, 255, 140, 0.5)"
                }}
                whileTap={{ scale: 0.95 }}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 10,
                    delay: 0.5
                }}
            >
                <span className="button-text">Get Started</span>
                <div className="button-glow"></div>
            </motion.button>
        </div>
    );
}

export default Home;