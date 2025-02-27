const chatBox = document.getElementById("chat-box");
const followupContainer = document.getElementById("followup-container");

let followupQuestions = []; 
let userResponses = [];
let stopTyping = false;
let chatHistory = JSON.parse(localStorage.getItem("chatHistory")) || []; // Load chat history from localStorage
let cameraStream = null; // To store the camera stream for later use


// Function to send a query
async function askQuery() {
    removeWelcomeMessage();
    stopTyping = false;
    let query = document.getElementById("query").value.trim();
    if (!query) return;

    appendMessage("You", query, "user-message");
    document.getElementById("query").value = "";

    let aiMessageContainer = document.createElement("div");
    aiMessageContainer.classList.add("ai-message");
    aiMessageContainer.innerHTML = "<span class='thinking'>Thinking</span> 🤔";
    chatBox.appendChild(aiMessageContainer);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        let response = await fetch("http://127.0.0.1:5001/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: query })
        });

        let data = await response.json();
        aiMessageContainer.remove(); // Remove the "Thinking" message

        // Save the query and response to chat history
        chatHistory.push({ query: query, response: data.response });
        localStorage.setItem("chatHistory", JSON.stringify(chatHistory)); // Save to localStorage
        updateChatHistory();

        // Display the first response with typing animation
        formatResponse("CureBot", data.response, "bot-message");

        // If there are follow-up questions, show them with typing animation
        if (data.followups && data.followups.length > 0) {
            setTimeout(() => {
                formatResponse("CureBot", "Here are some follow-up questions:", "bot-message");
                appendFollowupQuestions(data.followups);
            }, 1000); // Delay to simulate thinking
        }
    } catch (error) {
        console.error("Error:", error);
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}


// Function to display follow-up questions
function appendFollowupQuestions(questions) {
    let followupContainer = document.createElement("div");
    followupContainer.classList.add("followup-container");

    let questionList = document.createElement("ul");
    questionList.classList.add("followup-list");

    questions.forEach((question, index) => {
        let listItem = document.createElement("li");
        listItem.textContent = question;
        
        let inputField = document.createElement("input");
        inputField.type = "text";
        inputField.classList.add("followup-input");
        inputField.placeholder = "Your answer...";
        inputField.setAttribute("data-question", question);

        listItem.appendChild(inputField);
        questionList.appendChild(listItem);
    });

    let submitButton = document.createElement("button");
    submitButton.textContent = "Submit Answers";
    submitButton.classList.add("followup-submit");
    submitButton.onclick = submitFollowupAnswers;

    followupContainer.appendChild(questionList);
    followupContainer.appendChild(submitButton);
    chatBox.appendChild(followupContainer);
}


function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('active');
}

// Function to submit follow-up responses
async function submitFollowupAnswers() {
    let followupInputs = document.querySelectorAll(".followup-input");
    let followups = [];
    let responses = [];

    followupInputs.forEach(input => {
        followups.push(input.getAttribute("data-question"));
        responses.push(input.value.trim());
    });

    // Show "Analyzing..." animation
    let analyzingMessage = document.createElement("div");
    analyzingMessage.classList.add("ai-message");
    analyzingMessage.innerHTML = "<span class='thinking'>Analyzing...</span> 🤔";
    chatBox.appendChild(analyzingMessage);
    chatBox.scrollTop = chatBox.scrollHeight;

    try {
        let response = await fetch("http://127.0.0.1:5001/answer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ followups: followups, responses: responses })
        });

        let data = await response.json();
        analyzingMessage.remove(); // Remove the "Analyzing..." message

        // Display the final response with typing animation
        if (data.final_solution) {
            formatResponse("CureBot", data.final_solution, "bot-message");
        }
    } catch (error) {
        console.error("Error:", error);
    }
}

// Function to append messages in chat
function appendMessage(sender, text, className) {
    let messageDiv = document.createElement("div");
    messageDiv.classList.add("message", className);
    messageDiv.innerHTML = `<strong>${sender}:</strong> ${text}`;
    chatBox.appendChild(messageDiv);
    chatBox.scrollTop = chatBox.scrollHeight;
}

function formatResponse(sender, message, className) {
    let messageContainer = document.createElement("div");
    messageContainer.classList.add(className);

    let senderElement = document.createElement("strong");
    senderElement.textContent = sender + ": ";
    senderElement.style.color = "#00d1ff"; // Blue text for CureBot

    let messageContent = document.createElement("p");
    messageContent.dataset.fullText = message; // Store full message for instant reveal

    messageContainer.appendChild(senderElement);
    messageContainer.appendChild(messageContent);
    chatBox.appendChild(messageContainer);

    // Preserve line breaks and highlight numbered points
    let formattedText = message
        .replace(/\n/g, "<br>") // Preserve line breaks correctly
        .replace(/(\d+\.)/g, "<br><strong>$1</strong>"); // Highlight numbered points

    let words = formattedText.split(/(\s+|<br>)/); // Split message while keeping spaces and <br>
    let index = 0;
    stopTyping = false;

    function typeNextWord() {
        if (stopTyping) {
            messageContent.innerHTML = messageContent.dataset.fullText; // Instantly reveal full response
            showDownloadButton(); // Show the download button after response is fully displayed
            return;
        }
        if (index < words.length) {
            if (words[index] === "<br>") {
                messageContent.innerHTML += "<br>"; // Proper line breaks
            } else {
                messageContent.innerHTML += words[index]; // Add word
            }
            index++;
            setTimeout(typeNextWord, 50); // Adjust speed (lower = faster)
        } else {
            
        }
    }

    typeNextWord(); // Start animation
}

function showDownloadButton() {
    let downloadButton = document.getElementById("download-report-btn");
    if (downloadButton) {
        downloadButton.style.display = "block";
    }
}


// Function to open the camera
function openCamera() {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        navigator.mediaDevices.getUserMedia({ video: true })
            .then(function (stream) {
                cameraStream = stream;
                const video = document.createElement('video');
                video.autoplay = true;
                video.style.width = '320px';
                video.style.height = '240px';
                video.style.borderRadius = '8px';
                const chatBox = document.getElementById('chat-box');
                chatBox.appendChild(video);
                video.srcObject = stream;

                const captureButton = document.createElement('button');
                captureButton.innerText = 'Capture';
                captureButton.onclick = function () {
                    captureImage(video);
                };
                chatBox.appendChild(captureButton);

                const stopButton = document.createElement('button');
                stopButton.innerText = 'Stop Camera';
                stopButton.onclick = function () {
                    stopCamera(stream, video, captureButton, stopButton);
                };
                chatBox.appendChild(stopButton);
            })
            .catch(function (error) {
                console.error("Error accessing the camera: ", error);
            });
    } else {
        alert("Camera not supported in this browser.");
    }
}

// Function to capture an image from the video stream
function captureImage(video) {
    const canvas = document.createElement('canvas');
    canvas.width = 300;
    canvas.height = 250;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageUrl = canvas.toDataURL('image/png');
    const capturedImage = document.createElement('img');
    capturedImage.src = imageUrl;
    capturedImage.style.width = '150px'; // Set a reasonable width
    capturedImage.style.height = 'auto'; // Maintain aspect ratio
    capturedImage.style.border = 'none'; // Remove border
    const chatBox = document.getElementById('chat-box');
    chatBox.appendChild(capturedImage);
    sendCapturedImage(imageUrl);
    stopCamera(cameraStream, video);
}

// Function to send the captured image
function sendCapturedImage(imageUrl) {
    let chatBox = document.getElementById("chat-box");
    let userMessageContainer = document.createElement("div");
    userMessageContainer.classList.add("user-message");
    let imageElement = document.createElement("img");
    imageElement.src = imageUrl;
    imageElement.style.width = "150px"; // Set a reasonable width
    imageElement.style.height = "auto"; // Maintain aspect ratio
    imageElement.style.border = "none"; // Remove border
    userMessageContainer.appendChild(imageElement);
    chatBox.appendChild(userMessageContainer);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to stop the camera
function stopCamera(stream, video, captureButton, stopButton) {
    stream.getTracks().forEach(track => track.stop());
    video.remove();
    captureButton.remove();
    stopButton.remove();
}

// Function to remove the welcome message
function removeWelcomeMessage() {
    let welcomeMessage = document.getElementById("welcome-message");
    if (welcomeMessage) {
        welcomeMessage.style.animation = "fadeOut 1s forwards";
        setTimeout(() => welcomeMessage.remove(), 1000);
    }
}

// Function to stop the typing effect
function stopResponse() {
    stopTyping = true; // Set the global stop flag

    // Get all bot messages that are currently typing
    let typingMessages = document.querySelectorAll(".bot-message p");
    
    typingMessages.forEach((msg) => {
        if (msg.dataset.fullText) {
            msg.innerHTML = msg.dataset.fullText; // Instantly reveal full response
        }
    });
}


// Function to start speech recognition
function startSpeechRecognition() {
    removeWelcomeMessage();
    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.start();

    recognition.onresult = (event) => {
        const transcript = event.results[event.resultIndex][0].transcript;
        document.getElementById("query").value = transcript;

        if (event.results[event.resultIndex].isFinal) {
            askQuery();
        }
    };
}

// Function to update the chat history dropdown
function updateChatHistory() {
    let chatHistoryContainer = document.getElementById("chat-history-container");
    chatHistoryContainer.innerHTML = ""; // Clear previous history

    chatHistory.forEach((item, index) => {
        let historyItem = document.createElement("div");
        historyItem.classList.add("chat-history-item");
        historyItem.innerHTML = `
        <span class="query-text" title="${item.query}">${item.query.length > 20 ? item.query.substring(0, 20) + "..." : item.query}</span>
            <button onclick="loadChatResponse(${index})"><i class="fas fa-eye"></i> </button>
            <button onclick="deleteChatResponse(${index})"> <i class="fas fa-trash-alt"></i></button>
        `;
        chatHistoryContainer.appendChild(historyItem);
    });
}

// Function to generate the report content
function generateReportContent() {
    let reportContent = "Chat Report\n\n";
    chatHistory.forEach((item, index) => {
        reportContent += `Query ${index + 1}:\n`;
        reportContent += `You: ${item.query}\n`;
        reportContent += `CureBot: ${item.response}\n\n`;
    });
    return reportContent;
}

// Function to download the chat report
function downloadReport() {
    const reportContent = generateReportContent();
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat_report.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Function to show the download button
function showDownloadButton() {
    let downloadButton = document.getElementById("download-report-btn");
    if (downloadButton) {
        downloadButton.style.display = "block";
        downloadButton.onclick = downloadReport;
    }
}

// Function to load a specific chat response
function loadChatResponse(index) {
    let chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = ""; // Clear the chat box

    let query = chatHistory[index].query;
    let response = chatHistory[index].response;

    let userMessageContainer = document.createElement("div");
    userMessageContainer.classList.add("user-message");
    userMessageContainer.innerText = query;
    chatBox.appendChild(userMessageContainer);

    let aiMessageContainer = document.createElement("div");
    aiMessageContainer.classList.add("ai-message");
    aiMessageContainer.innerHTML = response;
    chatBox.appendChild(aiMessageContainer);

    chatBox.scrollTop = chatBox.scrollHeight;
}

// Function to delete a specific chat response
function deleteChatResponse(index) {
    chatHistory.splice(index, 1); // Remove the item from chat history
    localStorage.setItem("chatHistory", JSON.stringify(chatHistory)); // Update localStorage
    updateChatHistory(); // Refresh the history dropdown
}

// Function to toggle the chat history dropdown
function toggleChatHistory() {
    let chatDropdown = document.getElementById("chat-dropdown");
    chatDropdown.style.display = chatDropdown.style.display === "block" ? "none" : "block";
}

// Function to start a new chat
function startNewChat() {
    let chatBox = document.getElementById("chat-box");
    chatBox.innerHTML = ""; // Clear the chat box
    // Show welcome message
    let welcomeMessage = document.createElement("div");
    welcomeMessage.id = "welcome-message";
    welcomeMessage.innerText = "Welcome! How can I help you today?";
    chatBox.appendChild(welcomeMessage);
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Event listener for Enter key
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById("query").addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            askQuery();
        }
    });

    // Load chat history on page load
    updateChatHistory();

    document.querySelectorAll(".chat-history-item").forEach((item) => {
        item.addEventListener("click", function () {
            this.classList.toggle("expanded");
        });
    });


});