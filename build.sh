#!/bin/bash

# Set up the public directory for static assets
echo "Setting up public directory..."
mkdir -p public
cp favicon.webp public/
cp style.css public/
cp OGimage.webp public/

# Build the frontend with Vite
echo "Building the frontend..."
npm run build

# Ensure the server.js file has the correct permissions
echo "Setting permissions for server.js..."
chmod +x server.js

# Remove the old Docker container if it exists
echo "Removing old Docker container if it exists..."
docker-compose down

# Build and start the Docker container
echo "Building and starting the Docker container..."
docker-compose up -d

echo "Build complete! Your application should be running at http://localhost:8181" 