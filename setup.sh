#!/bin/bash

echo "🚀 Hospitality Analytics Dashboard - Quick Start"
echo "================================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v16 or higher."
    exit 1
fi

echo "✅ Node.js version: $(node --version)"
echo ""

# Setup Backend
echo "📦 Setting up Backend..."
cd backend

if [ ! -f ".env" ]; then
    echo "⚠️  Creating .env file from template..."
    cp .env.example .env
    echo "📝 Please edit backend/.env with your API credentials before proceeding"
    echo ""
    read -p "Press Enter after you've configured backend/.env..."
fi

if [ ! -d "node_modules" ]; then
    echo "📥 Installing backend dependencies..."
    npm install
    echo "✅ Backend dependencies installed"
else
    echo "✅ Backend dependencies already installed"
fi

cd ..
echo ""

# Setup Frontend
echo "📦 Setting up Frontend..."
cd frontend

if [ ! -d "node_modules" ]; then
    echo "📥 Installing frontend dependencies..."
    npm install
    echo "✅ Frontend dependencies installed"
else
    echo "✅ Frontend dependencies already installed"
fi

cd ..
echo ""

# Create startup scripts
echo "📝 Creating startup scripts..."

# Backend start script
cat > start-backend.sh << 'EOF'
#!/bin/bash
cd backend
echo "🚀 Starting Backend Server on http://localhost:3001"
npm run dev
EOF
chmod +x start-backend.sh

# Frontend start script
cat > start-frontend.sh << 'EOF'
#!/bin/bash
cd frontend
echo "🚀 Starting Frontend on http://localhost:3000"
npm run dev
EOF
chmod +x start-frontend.sh

# Combined start script
cat > start-all.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Hospitality Analytics Dashboard..."
echo ""

# Start backend in background
cd backend
npm run dev &
BACKEND_PID=$!
echo "✅ Backend started (PID: $BACKEND_PID)"

# Wait a moment for backend to start
sleep 3

# Start frontend
cd ../frontend
echo "✅ Starting Frontend..."
npm run dev

# Cleanup on exit
trap "kill $BACKEND_PID" EXIT
EOF
chmod +x start-all.sh

echo "✅ Startup scripts created"
echo ""

echo "================================================"
echo "✅ Setup Complete!"
echo "================================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Configure API credentials in backend/.env"
echo "   - Google Analytics 4 Property ID"
echo "   - Google service account key"
echo "   - Cloudbeds access token"
echo ""
echo "2. Start the application:"
echo "   Option A - Start everything: ./start-all.sh"
echo "   Option B - Start separately:"
echo "              Terminal 1: ./start-backend.sh"
echo "              Terminal 2: ./start-frontend.sh"
echo ""
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "For detailed setup instructions, see SETUP_GUIDE.md"
echo ""
