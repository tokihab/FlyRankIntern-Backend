FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache python3 make g++ chromium font-noto-emoji freetype harfbuzz nss ca-certificates
COPY package*.json ./
RUN npm install --build-from-source=better-sqlite3
COPY . .
EXPOSE 3000
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
CMD ["node", "server.js"]
