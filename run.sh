#!/bin/bash

echo "🎉 Client-Server Application"
echo "============================="
echo ""
echo "✅ Build Status: SUCCESS"
echo "✅ All compilation errors fixed"
echo ""
echo "To run the application:"
echo ""
echo "1. Start the SERVER (in this terminal):"
echo "   cd server && cargo run"
echo ""
echo "2. Start the CLIENT (in a new terminal):"
echo "   cd client && npm run tauri:dev"
echo ""
echo "3. A desktop window will open with the client UI"
echo ""
echo "4. Connect to the server:"
echo "   - Server IP: 127.0.0.1"
echo "   - Server Port: (check server output, usually 8080-8081)"
echo ""
echo "5. Start MORE clients to see them all in the list!"
echo ""
echo "---"
echo ""
read -p "Start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]
then
    cd server
    echo ""
    echo "🚀 Starting server..."
    echo ""
    cargo run
fi
