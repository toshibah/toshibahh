import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = 3000;

  // Socket.io signaling logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId, userId) => {
      socket.join(roomId);
      if (userId) {
        socket.join(userId); // Also join a room named after the user's UID for direct calls
      }
      console.log(`User ${userId} joined room ${roomId}`);
      socket.to(roomId).emit("user-joined", userId);
    });

    socket.on("identify", (userId) => {
      socket.join(userId);
      socket.join("general"); // Join general chat room
      console.log(`User ${userId} identified with socket ${socket.id}`);
    });

    socket.on("typing", (payload) => {
      // payload: { to: string, from: string, name: string, isTyping: boolean }
      // to can be a userId or "general"
      socket.to(payload.to).emit("user-typing", payload);
    });

    socket.on("offer", (payload) => {
      io.to(payload.target).emit("offer", {
        offer: payload.offer,
        sender: payload.sender
      });
    });

    socket.on("answer", (payload) => {
      io.to(payload.target).emit("answer", {
        answer: payload.answer,
        sender: payload.sender
      });
    });

    socket.on("ice-candidate", (payload) => {
      io.to(payload.target).emit("ice-candidate", {
        candidate: payload.candidate,
        sender: payload.sender
      });
    });

    socket.on("call-user", (payload) => {
      io.to(payload.userToCall).emit("incoming-call", {
        signal: payload.signalData,
        from: payload.from,
        name: payload.name,
        photo: payload.photo,
        roomId: payload.roomId
      });
    });

    socket.on("answer-call", (payload) => {
      io.to(payload.to).emit("call-accepted", payload.signal);
    });

    socket.on("end-call", (payload) => {
      io.to(payload.to).emit("call-ended");
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
