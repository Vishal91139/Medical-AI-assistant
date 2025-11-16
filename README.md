# Chat AI App

Lightweight AI chat application powered by **Stream Chat** and a **MedGemma (Gradio) backend**. Focuses purely on real-time messaging and image+text AI interaction.

## 🚀 Features

- **Real-time Chat** via GetStream
- **MedGemma Integration** (Gradio endpoint) for AI replies
- **Image Attachments** forwarded to the AI model
- **Agent Lifecycle** (start / status / stop)
- **Clean Minimal UI** with dark mode

## 🏗️ Architecture

### Backend (`nodejs-ai-assistant/`)

- Node.js + Express
- Stream Chat server SDK
- MedGemma agent bridging messages to a Gradio app
- Automatic disposal of inactive agents

### Frontend (`react-stream-ai-assistant/`)

- React + TypeScript + Vite
- Stream Chat React components
- Tailwind CSS + shadcn/ui

## 📋 Prerequisites

- Node.js 20+
- GetStream.io account
- Running MedGemma Gradio endpoint (public URL)

## 🛠️ Setup Instructions

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd chat-ai-app
```

### 2. Backend Setup

Navigate to the backend directory:

```bash
cd nodejs-ai-assistant
```

Install dependencies:

```bash
npm install
```

Create environment file by copying the example:

```bash
cp .env.example .env
```

Configure your backend `.env` file with the following keys:

```env
# Stream credentials
STREAM_API_KEY=your_stream_api_key_here
STREAM_API_SECRET=your_stream_api_secret_here
STREAM_APP_ID=your_stream_app_id_here

# MedGemma (Gradio) configuration
GRADIO_BASE_URL=https://your-gradio.hf.space/
GRADIO_API_NAME=/predict
DEFAULT_AGENT_PLATFORM=medgemma
PORT=4550
```

### 3. Frontend Setup

Navigate to the frontend directory:

```bash
cd ../react-stream-ai-assistant
```

Install dependencies:

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Configure your frontend `.env` file:

```env
# Stream Chat Configuration
VITE_STREAM_API_KEY=your_stream_api_key_here

# Backend URL (match backend PORT)
VITE_BACKEND_URL=http://localhost:4550

### 4. Kaggle GPU: MedGemma + Gradio

If you want to run the MedGemma model on Kaggle (GPU) and expose a public Gradio endpoint, use the following cells in a Kaggle Notebook:

```python
# Cell 1: Install required packages
!pip install -q -U transformers accelerate huggingface-hub safetensors bitsandbytes pillow requests gradio

# Cell 2: Login, Check GPU, and Load Model
import torch
import gradio as gr
from transformers import AutoProcessor, AutoModelForImageTextToText
from huggingface_hub import login
from kaggle_secrets import UserSecretsClient
from PIL import Image
import os

print(f"Torch version: {torch.__version__}")
print(f"CUDA available: {torch.cuda.is_available()}")
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

# Hugging Face login via Kaggle Secrets (set key name HF_TOKENS)
try:
    user_secrets = UserSecretsClient()
    hf_token = user_secrets.get_secret("HF_TOKENS")
    login(token=hf_token)
    print("Logged in to Hugging Face successfully.")
except Exception as e:
    print(f"Could not log in to Hugging Face. Add HF_TOKENS to Kaggle Secrets. Error: {e}")

print("Loading model... This may take a few minutes.")
model_id = "google/medgemma-4b-it"
model = AutoModelForImageTextToText.from_pretrained(
    model_id,
    torch_dtype=torch.bfloat16,
    device_map="auto",
)
processor = AutoProcessor.from_pretrained(model_id)
print("Model loaded successfully.")

# Cell 3: Define the Prediction Function
from PIL import Image

def predict_api(message_dict, history):
    messages = [{"role": "system", "content": [{"type": "text", "text": "You are an expert doctor."}]}]
    for user_msg, bot_msg in history:
        messages.append({"role": "user", "content": [{"type": "text", "text": user_msg}]})
        messages.append({"role": "assistant", "content": [{"type": "text", "text": bot_msg}]})

    user_text = message_dict['text']
    image_files = message_dict.get('files', [])
    current_content = []
    if image_files:
        image_path = image_files[0]
        image = Image.open(image_path)
        current_content.append({"type": "image", "image": image})
    current_content.append({"type": "text", "text": user_text})
    messages.append({"role": "user", "content": current_content})

    inputs = processor.apply_chat_template(
        messages,
        add_generation_prompt=True,
        tokenize=True,
        return_dict=True,
        return_tensors="pt"
    ).to(model.device, dtype=torch.bfloat16)

    input_len = inputs["input_ids"].shape[-1]
    with torch.inference_mode():
        generation = model.generate(**inputs, max_new_tokens=512, do_sample=False)
        generation = generation[0][input_len:]
    decoded = processor.decode(generation, skip_special_tokens=True)
    return decoded

# Cell 4: Launch the Gradio Chat Interface (gets a public URL)
print("Launching Gradio interface... This will provide a public URL.")
gr.ChatInterface(
    predict_api,
    multimodal=True
).launch(
    debug=True,
    share=True  # IMPORTANT: needed for a public URL
)
```

After running, copy the public Gradio URL and set it in your backend `.env`:

```env
GRADIO_BASE_URL=https://<your-gradio-subdomain>.gradio.live/
# For Gradio ChatInterface, the API path is commonly /predict
GRADIO_API_NAME=/predict
```
```

### 4. Getting API Keys

#### GetStream.io Setup

1. Sign up at [GetStream.io](https://getstream.io/chat/trial/)
2. Create a new Chat application
3. Copy your **API Key** and **API Secret** from the dashboard
4. Use the same **API Key** in both backend and frontend `.env` files

#### MedGemma (Gradio) Setup

1. Deploy or open a public Gradio MedGemma space
2. Copy the public base URL (e.g. `https://xxxx.gradio.live/` or HF Space URL)
3. Identify the API endpoint path (often `/predict` or `/chat`)
4. Place both in the backend `.env`

## 🚀 Running the Application

### Start the Backend Server

```bash
cd nodejs-ai-assistant
npm run dev
```

The backend will run on `http://localhost:4550`

### Start the Frontend Application

```bash
cd react-stream-ai-assistant
npm run dev
```

The frontend will run on the port Vite prints (typically 5173)

## 🧭 Publishing to GitHub

Initialize a new Git repo (or use the existing one), commit, and push:

```powershell
git init
git add .
git commit -m "Initial commit: Stream + MedGemma chat"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

Make sure you do NOT commit actual `.env` files. Use the provided `.env.example` files for sharing configuration keys.

## 📖 How GetStream.io Works

[GetStream.io](https://getstream.io) is a cloud-based API service that provides real-time chat functionality. Here's how it integrates with our app:

### Core Concepts

1. **Stream Chat Client**: Handles all chat operations and real-time updates
2. **Channels**: Individual chat rooms where messages are exchanged
3. **Users**: Authenticated participants in the chat
4. **Messages**: Text, files, reactions, and custom data
5. **Tokens**: JWT-based authentication for secure access

### Integration Flow

```mermaid
graph TD
    A[Frontend React App] --> B[Stream Chat React Components]
    B --> C[Stream Chat API]
    C --> D[Backend Node.js Server]
    D --> E[MedGemma (Gradio)]
    D --> F[AI Agent Management]
```

### Key Features Used

- **Real-time Messaging**: Instant message delivery and updates
- **User Presence**: Online/offline status indicators
- **Channel Management**: Create, join, and manage chat channels
- **Message Threading**: Support for threaded conversations
- **File Uploads**: Share images and documents
- **Custom Fields**: Extended message and user data
- **Webhooks**: Server-side event handling

## 🤖 AI Agent System

The application features a sophisticated AI agent management system:

### Agent Lifecycle

1. Creation per channel
2. Initialization (connect to Gradio)
3. Message handling (text + image URLs)
4. Timeout & cleanup for inactivity

### Agent Capabilities

- **Content Writing**: Various writing tasks from business to creative
- **Web Research**: Live search for current information and facts
- **Context Awareness**: Maintains conversation context
- **Customizable Prompts**: Specialized writing assistance

## 🎨 UI Components

The frontend uses modern UI components built with:

- **Radix UI**: Accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Beautiful, customizable components
- **Lucide React**: Modern icon library
- **Dark Mode Support**: System preference detection

## 📡 API Endpoints

### Backend Routes

- `GET /` - Health check and server status
- `POST /start-ai-agent` - Initialize AI agent for a channel
- `POST /stop-ai-agent` - Stop and cleanup AI agent
- `GET /agent-status` - Check AI agent status
- `POST /token` - Generate user authentication tokens

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Environment Variables**: Sensitive data protection
- **CORS Configuration**: Cross-origin request security
- **Token Expiration**: Automatic token refresh system
- **Input Validation**: Server-side validation for all requests

## 🚀 Deployment

### Backend Deployment

1. Set environment variables on your hosting platform
2. Run `npm run start` for production
3. Ensure PORT is configured (defaults to 3000)

### Frontend Deployment

1. Run `npm run build` to create production build
2. Deploy the `dist` folder to your static hosting service
3. Configure environment variables for production

## 🛠️ Development

### Backend Development

```bash
cd nodejs-ai-assistant
npm run dev  # Starts with nodemon for auto-reload
```

### Frontend Development

```bash
cd react-stream-ai-assistant
npm run dev  # Starts Vite dev server
```

### Building for Production

```bash
# Backend
cd nodejs-ai-assistant
npm run start

# Frontend
cd react-stream-ai-assistant
npm run build
```

## 📚 Technologies Used

### Backend

- Node.js
- Express
- Stream Chat
- Gradio Client
- CORS
- TypeScript

### Frontend

- **React** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Stream Chat React** - Chat UI components
- **Tailwind CSS** - Styling
- **Radix UI** - Accessible components
- **React Hook Form** - Form handling
- **React Router** - Navigation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:

- Check the [GetStream.io Documentation](https://getstream.io/chat/docs/)
- Create an issue in this repository

---

Built with ❤️ using GetStream.io, MedGemma, and modern web technologies.
