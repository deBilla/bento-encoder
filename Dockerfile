# Use an official Node.js runtime as a parent image
FROM node:14

# Install Bento4 dependencies
RUN apt-get update && apt-get install -y \
    cmake \
    g++ \
    git \
    make \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Clone and build Bento4
RUN git clone https://github.com/axiomatic-systems/Bento4.git /opt/Bento4 \
    && cd /opt/Bento4 \
    && mkdir build && cd build \
    && cmake .. \
    && make -j4 \
    && make install

# Copy the Node.js application source code into the container
COPY . .

# Install Node.js dependencies
RUN npm install

# Expose the port that your Node.js application will listen on
EXPOSE 3000

# Define the command to run your Node.js application
CMD ["node", "ffmpeg_encoder.js"]