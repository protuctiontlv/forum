# TLV-Production Forum

A lightweight real-time forum built with FastAPI, MongoDB and WebSockets.

## Features

- User registration
- Username and age
- Avatar from URL or uploaded image
- User profiles
- Real-time general chat
- Messages stored in MongoDB
- Message history after page reload
- Avatar files stored in MongoDB GridFS
- Automatic WebSocket reconnection
- Session-based authentication

## Tech Stack

- Python
- FastAPI
- MongoDB Atlas
- PyMongo
- WebSockets
- HTML
- CSS
- JavaScript

## Project Structure

```text
forum/
├── app/
│   ├── main.py
│   └── static/
│       ├── index.html
│       ├── style.css
│       └── app.js
├── requirements.txt
├── render.yaml
├── .gitignore
└── README.md
