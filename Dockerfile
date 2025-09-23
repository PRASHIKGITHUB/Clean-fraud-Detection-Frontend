# Use Node.js official image
FROM node:22-alpine

# Set working directory inside the container
WORKDIR /app

# Copy only package.json and package-lock.json first (better caching)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the project files
COPY . .

# Expose port (React dev server runs on 5173)
EXPOSE 5173

# Run the React app in dev mode
CMD ["npm", "run", "dev", "--", "--host"]

