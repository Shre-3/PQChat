# PQChat

A post-quantum secure chat application using Kyber for key encapsulation facilitating a quantum safe messaging experience.

## Features

- End-to-end encryption using post-quantum cryptography
- Real-time messaging using WebSocket
- Modern React UI with Tailwind CSS
- Kyber for key encapsulation
- AES-GCM for symmetric encryption

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. Clone the repository

2. Install dependencies:

```bash
npm install
```

## Development

To run the application in development mode:

```bash
npm run dev
```

This will start both the WebSocket server and the React development server.

## Production

To build and run the application in production mode:

1. Build the React application:

```bash
npm run build
```

2. Start the server:

```bash
npm start
```

## Security

This application uses post-quantum cryptography to ensure security against quantum computers:

- Kyber for key encapsulation (KEM)
- AES-GCM for symmetric encryption
- MLKEM for key derivation

## License

MIT
