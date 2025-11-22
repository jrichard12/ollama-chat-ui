// ===========================
// Configuration
// ===========================
const OLLAMA_BASE_URL = 'http://127.0.0.1:11434';
let currentModel = '';
let availableModels = [];

// ===========================
// DOM Elements
// ===========================
const selectedModelInfo = document.getElementById('selectedModelInfo');
const modelDetails = document.getElementById('modelDetails');
const selectedModelDropdown = document.getElementById('selectedModel');
const messagesContainer = document.getElementById('messagesContainer');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

// ===========================
// Initialization
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
  setupEventListeners();
});

async function initializeApp() {
  try {
    await loadAvailableModels();
  } catch (error) {
    console.error('Initialization error:', error);
    showError('Failed to connect to Ollama. Make sure it is running on port 11434.');
  }
}

function setupEventListeners() {
  // Enter key to send message
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  
  // Send button click
  sendBtn.addEventListener('click', () => {
    sendMessage();
  });
  
  // Clear chat button click
  clearChatBtn.addEventListener('click', () => {
    clearChat();
  });
  
  // Model dropdown change
  selectedModelDropdown.addEventListener('change', (e) => {
    currentModel = e.target.value;
    if (currentModel) {
      updateSelectedModelDisplay(currentModel);
      loadModelDetails(currentModel);
    }
  });
}

// ===========================
// List Available Models
// ===========================
async function loadAvailableModels() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`);
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    availableModels = data.models || [];
    
    if (availableModels.length === 0) {
      selectedModelInfo.innerHTML = '<p class="placeholder-text">No models available</p>';
      return;
    }
    
    // Populate dropdown
    populateModelDropdown();
    
    // Select first model by default
    if (availableModels.length > 0) {
      currentModel = availableModels[0].name;
      selectedModelDropdown.value = currentModel;
      updateSelectedModelDisplay(currentModel);
      loadModelDetails(currentModel);
    }
    
  } catch (error) {
    console.error('Error loading models:', error);
    selectedModelInfo.innerHTML = '<p class="error-message">Failed to load models</p>';
  }
}

function updateSelectedModelDisplay(modelName) {
  const model = availableModels.find(m => m.name === modelName);
  if (!model) return;
  
  const size = model.size ? formatBytes(model.size) : 'Unknown size';
  const modified = model.modified_at ? new Date(model.modified_at).toLocaleDateString() : '';
  
  selectedModelInfo.innerHTML = `
    <div class="model-name">${model.name}</div>
    <div class="model-size">${size}${modified ? ' • ' + modified : ''}</div>
  `;
}

function createModelItem(model) {
  const div = document.createElement('div');
  div.className = 'model-item';
  
  const size = model.size ? formatBytes(model.size) : 'Unknown size';
  const modified = model.modified_at ? new Date(model.modified_at).toLocaleDateString() : '';
  
  div.innerHTML = `
    <div class="model-name">${model.name}</div>
    <div class="model-size">${size}${modified ? ' • ' + modified : ''}</div>
  `;
  
  // Click to view details
  div.addEventListener('click', () => {
    document.querySelectorAll('.model-item').forEach(item => {
      item.classList.remove('selected');
    });
    div.classList.add('selected');
    loadModelDetails(model.name);
    currentModel = model.name;
    selectedModelDropdown.value = model.name;
  });
  
  return div;
}

function populateModelDropdown() {
  selectedModelDropdown.innerHTML = '<option value="">Select a model...</option>';
  availableModels.forEach(model => {
    const option = document.createElement('option');
    option.value = model.name;
    option.textContent = model.name;
    selectedModelDropdown.appendChild(option);
  });
}

// ===========================
// Display Model Details
// ===========================
async function loadModelDetails(modelName) {
  try {
    modelDetails.innerHTML = '<div class="loading">Loading details...</div>';
    
    const response = await fetch(`${OLLAMA_BASE_URL}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    
    const data = await response.json();
    
    // Display model information
    let detailsHTML = `
      <p><strong>Model:</strong> ${data.modelfile ? modelName : 'N/A'}</p>
    `;
    
    if (data.details) {
      if (data.details.format) {
        detailsHTML += `<p><strong>Format:</strong> ${data.details.format}</p>`;
      }
      if (data.details.family) {
        detailsHTML += `<p><strong>Family:</strong> ${data.details.family}</p>`;
      }
      if (data.details.parameter_size) {
        detailsHTML += `<p><strong>Parameters:</strong> ${data.details.parameter_size}</p>`;
      }
    }
    
    modelDetails.innerHTML = detailsHTML;
    
  } catch (error) {
    console.error('Error loading model details:', error);
    modelDetails.innerHTML = '<p class="error-message">Failed to load details</p>';
  }
}

// ===========================
// Chat Functionality
// ===========================
async function sendMessage() {
  const text = userInput.value.trim();
  
  if (!text) {
    return;
  }
  
  if (!currentModel) {
    showError('Please select a model first');
    return;
  }
  
  // Clear welcome message if present
  const welcomeMsg = messagesContainer.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }
  
  // Add user message
  addMessage(text, 'user');
  userInput.value = '';
  
  // Disable input while processing
  sendBtn.disabled = true;
  userInput.disabled = true;
  
  // Add typing indicator
  const typingDiv = addTypingIndicator();
  
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: currentModel,
        prompt: text,
        stream: true
      })
    });
    
    if (!response.ok || !response.body) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
    }
    
    // Remove typing indicator
    typingDiv.remove();
    
    // Create bot message bubble
    const botMessageDiv = addMessage('', 'bot');
    const botBubble = botMessageDiv.querySelector('.message-bubble');
    
    // Stream response
    let fullResponse = '';
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        try {
          const data = JSON.parse(trimmed);
          
          if (data.error) {
            throw new Error(data.error);
          }
          
          if (data.response) {
            fullResponse += data.response;
            botBubble.textContent = fullResponse;
            
            // Auto-scroll to bottom
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
          
        } catch (parseError) {
          // Ignore partial JSON
          if (!trimmed.startsWith('{')) {
            console.warn('Parse error:', parseError);
          }
        }
      }
    }
    
  } catch (error) {
    console.error('Chat error:', error);
    typingDiv.remove();
    showError(`Failed to get response: ${error.message}`);
  } finally {
    // Re-enable input
    sendBtn.disabled = false;
    userInput.disabled = false;
    userInput.focus();
  }
}

// ===========================
// UI Helper Functions
// ===========================
function addMessage(text, type) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;
  
  const label = type === 'user' ? 'You' : 'AI Assistant';
  
  messageDiv.innerHTML = `
    <div class="message-label">${label}</div>
    <div class="message-bubble">${escapeHtml(text)}</div>
  `;
  
  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return messageDiv;
}

function addTypingIndicator() {
  const typingDiv = document.createElement('div');
  typingDiv.className = 'message bot';
  typingDiv.innerHTML = `
    <div class="message-label">AI Assistant</div>
    <div class="message-bubble typing-indicator">
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
      <div class="typing-dot"></div>
    </div>
  `;
  
  messagesContainer.appendChild(typingDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  return typingDiv;
}

function showError(message) {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = message;
  
  messagesContainer.appendChild(errorDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

// ===========================
// Utility Functions
// ===========================
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function clearChat() {
  // Remove all messages except welcome message
  const messages = messagesContainer.querySelectorAll('.message, .error-message');
  messages.forEach(message => {
    message.remove();
  });
  
  // Add back the welcome message if it doesn't exist
  if (!messagesContainer.querySelector('.welcome-message')) {
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
      <div class="welcome-icon">🌱</div>
      <h3 class="welcome-text">Welcome!</h3>
      <p>Select a model and start your conversation</p>
    `;
    messagesContainer.appendChild(welcomeDiv);
  }
}
