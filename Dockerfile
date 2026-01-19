# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Install system dependencies for psycopg2 and other packages
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy the requirements file into the container
COPY requirements.txt .

# Install backend dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the entire monorepo into the container
COPY . .

# Set environment variables
# This allows 'from app import ...' to work by adding backend to the path
ENV PYTHONPATH=/app/backend
ENV PORT=8080

# Run the FastAPI application using uvicorn
# We run from /app/backend to match the local development pathing
WORKDIR /app/backend
CMD python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
