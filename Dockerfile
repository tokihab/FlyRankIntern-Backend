FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm install --build-from-source=better-sqlite3
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]