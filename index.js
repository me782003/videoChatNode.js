const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      process.env.CLIENT_ORIGIN, // ← يسمح بالدومين اللي جاي من .env
    ],
    methods: ["GET", "POST"],
  },
});

// 🗺️ خريطة المستخدمين: socket.id => userId
const users = new Map();

io.on("connection", (socket) => {
  console.log(`🔌 User connected: ${socket.id}`);

  // تسجيل مستخدم
  socket.on("register-user", (userId) => {
    users.set(socket.id, userId);
    console.log("✅ User registered:", userId);
    sendUserList();
  });

  // مكالمة صادرة
  socket.on("call-user", ({ targetId, offer }) => {
    console.log(`📞 مكالمة من ${socket.id} إلى ${targetId}`);
    io.to(targetId).emit("incoming-call", {
      from: socket.id,
      offer,
      name: users.get(socket.id),
    });
  });

  // قبول المكالمة
  socket.on("answer-call", ({ targetId, answer }) => {
    io.to(targetId).emit("call-answered", {
      from: socket.id,
      answer,
    });
  });

  // تبادل ICE
  socket.on("ice-candidate", ({ targetId, candidate }) => {
    io.to(targetId).emit("ice-candidate", {
      from: socket.id,
      candidate,
    });
  });

  // إنهاء المكالمة
  socket.on("end-call", ({ targetId }) => {
    console.log(`📴 مكالمة انتهت من ${socket.id} إلى ${targetId}`);
    io.to(targetId).emit("end-call");
  });

  // فصل المستخدم
  socket.on("disconnect", () => {
    console.log(`❌ User disconnected: ${socket.id}`);
    users.delete(socket.id);
    sendUserList();
  });

  socket.on("chat-message", ({ targetId, message }) => {
    io.to(targetId).emit("chat-message", {
      from: socket.id,
      message,
    });
  });

  // تحديث قائمة المستخدمين لكل متصل
  const sendUserList = () => {
    const fullList = Array.from(users.entries());
    users.forEach((_, userSocketId) => {
      const filteredList = fullList.filter(([id]) => id !== userSocketId);
      io.to(userSocketId).emit("update-user-list", filteredList);
    });
  };
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on http://0.0.0.0:${PORT}`);
});
