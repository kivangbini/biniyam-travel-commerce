const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");
const PUBLIC_DIR = path.join(__dirname, "public");
const ADMIN_USER = process.env.ADMIN_USER || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "ChangeThisAdminPassword123!";
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex");

if (process.env.NODE_ENV === "production" && (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === "ChangeThisAdminPassword123!" || !process.env.SESSION_SECRET || !process.env.ADMIN_USER)) {
  console.error("Production startup blocked: set ADMIN_USER, a strong ADMIN_PASSWORD, and SESSION_SECRET environment variables.");
  process.exit(1);
}

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({
    products: [
      {id:"p1",name:"Handwoven Ethiopian Scarf",category:"Crafts",price:850,description:"Colorful handwoven scarf inspired by Ethiopian textiles.",emoji:"🧣",stock:20},
      {id:"p2",name:"Coffee Gift Pack",category:"Coffee",price:1200,description:"A gift-ready pack of locally sourced Ethiopian coffee.",emoji:"☕",stock:30},
      {id:"p3",name:"Traditional Basket",category:"Crafts",price:1600,description:"Decorative woven basket made by local artisans.",emoji:"🧺",stock:12},
      {id:"p4",name:"Travel Daypack",category:"Travel Gear",price:2400,description:"A practical daypack for city trips and hikes.",emoji:"🎒",stock:15}
    ],
    packages: [
      {id:"t1",name:"Bahir Dar & Lake Tana",location:"Bahir Dar, Ethiopia",days:"2 days / 1 night",price:6500,description:"Explore Lake Tana, lakeside views and the Blue Nile Falls area.",emoji:"🌊"},
      {id:"t2",name:"Lalibela Heritage Tour",location:"Lalibela, Ethiopia",days:"3 days / 2 nights",price:14500,description:"Discover the remarkable rock-hewn churches with a local guide.",emoji:"⛪"},
      {id:"t3",name:"Gondar Royal Castles",location:"Gondar, Ethiopia",days:"2 days / 1 night",price:9000,description:"Visit the Royal Enclosure and explore the historic city.",emoji:"🏰"}
    ],
    bookings: [],
    hotelBookings: [],
    orders: [],
    messages: [],
    settings: { telebirrInstructions: "Contact our team to confirm the current Telebirr merchant number before sending payment." }
  }, null, 2));
}

function loadStore() { return JSON.parse(fs.readFileSync(DATA_FILE, "utf8")); }
function saveStore(data) { fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2)); }
function send(res, status, body, type="application/json; charset=utf-8", extra={}) {
  res.writeHead(status, {"Content-Type":type, "X-Content-Type-Options":"nosniff", "X-Frame-Options":"DENY", "Referrer-Policy":"same-origin", ...extra});
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", chunk => { data += chunk; if (data.length > 1e6) { reject(new Error("Request too large")); req.destroy(); } });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}
function safeEqual(a,b) {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa,bb);
}
function parseCookies(req) {
  const out = {};
  (req.headers.cookie || "").split(";").forEach(part => {
    const i = part.indexOf("=");
    if (i > -1) out[part.slice(0,i).trim()] = decodeURIComponent(part.slice(i+1).trim());
  });
  return out;
}
function signature(value) { return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("hex"); }
function adminSession(req) {
  const token = parseCookies(req).admin_session || "";
  const parts = token.split(".");
  if (parts.length !== 2 || !safeEqual(parts[1], signature(parts[0]))) return false;
  try { const payload = JSON.parse(Buffer.from(parts[0], "base64url").toString()); return payload.admin === true && payload.exp > Date.now(); }
  catch { return false; }
}
function requireAdmin(req,res) {
  if (!adminSession(req)) { send(res,401,{error:"Admin login required"}); return false; }
  return true;
}
function text(v, max=200) { return String(v ?? "").trim().slice(0,max); }
function number(v) { const n = Number(v); return Number.isFinite(n) && n >= 0 ? n : null; }
function id(prefix) { return prefix + "-" + crypto.randomBytes(5).toString("hex").toUpperCase(); }

const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const route = url.pathname;
  try {
    if (route === "/api/public" && req.method === "GET") {
      const d = loadStore();
      return send(res,200,{products:d.products,packages:d.packages,settings:d.settings});
    }
    if (route === "/api/contact" && req.method === "POST") {
      const b = await readBody(req);
      const name=text(b.name,100), email=text(b.email,150), message=text(b.message,1500);
      if (!name || !email.includes("@") || !message) return send(res,400,{error:"Enter your name, valid email and message."});
      const d=loadStore(); d.messages.unshift({id:id("MSG"),name,email,message,createdAt:new Date().toISOString()}); saveStore(d);
      return send(res,201,{ok:true,message:"Message received. The demo has saved it for the site admin."});
    }
    if (route === "/api/bookings" && req.method === "POST") {
      const b=await readBody(req);
      const name=text(b.name,100), email=text(b.email,150), phone=text(b.phone,50), packageId=text(b.packageId,50), date=text(b.date,20), guests=Number(b.guests);
      const d=loadStore(), pkg=d.packages.find(x=>x.id===packageId);
      if (!name || !email.includes("@") || !phone || !pkg || !date || !Number.isInteger(guests) || guests<1 || guests>30)
        return send(res,400,{error:"Please complete all booking fields."});
      const item={id:id("BOOK"),name,email,phone,packageId,packageName:pkg.name,date,guests,note:text(b.note,700),status:"New",createdAt:new Date().toISOString()};
      d.bookings.unshift(item); saveStore(d);
      return send(res,201,{ok:true,bookingId:item.id,message:"Booking request received. Our team must confirm availability and price."});
    }
    if (route === "/api/hotels" && req.method === "POST") {
      const b=await readBody(req);
      const name=text(b.name,100), email=text(b.email,150), phone=text(b.phone,50);
      const hotel=text(b.hotel,150), checkIn=text(b.checkIn,20), checkOut=text(b.checkOut,20);
      const guests=Number(b.guests), rooms=Number(b.rooms);
      if (!name || !email.includes("@") || !phone || !hotel || !checkIn || !checkOut ||
          checkOut <= checkIn || !Number.isInteger(guests) || guests<1 || guests>30 ||
          !Number.isInteger(rooms) || rooms<1 || rooms>10)
        return send(res,400,{error:"Please complete the hotel, guest, room and date fields. Check-out must be after check-in."});
      const d=loadStore();
      if (!Array.isArray(d.hotelBookings)) d.hotelBookings=[];
      const item={id:id("HOTEL"),name,email,phone,hotel,checkIn,checkOut,guests,rooms,note:text(b.note,700),status:"New",createdAt:new Date().toISOString()};
      d.hotelBookings.unshift(item); saveStore(d);
      return send(res,201,{ok:true,bookingId:item.id,message:"Hotel booking request received. Availability and rates must be confirmed by our team."});
    }
    if (route === "/api/orders" && req.method === "POST") {
      const b=await readBody(req), customer=text(b.name,100), email=text(b.email,150), phone=text(b.phone,50), address=text(b.address,300), paymentMethod=text(b.paymentMethod,40);
      if (!customer || !email.includes("@") || !phone || !address || !["Telebirr","CBE Birr","CBE Bank Transfer"].includes(paymentMethod) || !Array.isArray(b.items) || !b.items.length || b.items.length>50)
        return send(res,400,{error:"Please complete customer and delivery details."});
      const d=loadStore(), orderItems=[];
      for (const line of b.items) {
        const product=d.products.find(p=>p.id===text(line.id,50));
        const qty=Number(line.quantity);
        if (!product || !Number.isInteger(qty) || qty<1 || qty>99) return send(res,400,{error:"Invalid product or quantity."});
        if (product.stock < qty) return send(res,400,{error:`Not enough stock for ${product.name}.`});
        orderItems.push({id:product.id,name:product.name,price:product.price,quantity:qty});
      }
      const total=orderItems.reduce((s,x)=>s+x.price*x.quantity,0);
      const order={id:id("ORD"),name:customer,email,phone,address,items:orderItems,total,paymentMethod,status:"Awaiting confirmation",createdAt:new Date().toISOString()};
      d.orders.unshift(order); saveStore(d);
      return send(res,201,{ok:true,orderId:order.id,total,message:`Order saved. Selected payment: ${paymentMethod}. Biniyam will confirm official payment details. Do not send money until merchant details are verified.`});
    }
    if (route === "/api/admin/login" && req.method === "POST") {
      const b=await readBody(req);
      if (!safeEqual(text(b.username,100),ADMIN_USER) || !safeEqual(String(b.password || ""),ADMIN_PASSWORD))
        return send(res,401,{error:"Incorrect admin username or password."});
      const payload=Buffer.from(JSON.stringify({admin:true,exp:Date.now()+8*60*60*1000})).toString("base64url");
      const cookie=`admin_session=${encodeURIComponent(payload+"."+signature(payload))}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` + (process.env.NODE_ENV==="production" ? "; Secure" : "");
      return send(res,200,{ok:true}, "application/json; charset=utf-8", {"Set-Cookie":cookie});
    }
    if (route === "/api/admin/logout" && req.method === "POST") {
      return send(res,200,{ok:true},"application/json; charset=utf-8",{"Set-Cookie":"admin_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0"});
    }
    if (route.startsWith("/api/admin/")) {
      if (!requireAdmin(req,res)) return;
      const d=loadStore();
      if (route === "/api/admin/data" && req.method === "GET")
        return send(res,200,{products:d.products,packages:d.packages,bookings:d.bookings,hotelBookings:d.hotelBookings||[],orders:d.orders,messages:d.messages,settings:d.settings});
      if (route === "/api/admin/products" && req.method === "POST") {
        const b=await readBody(req), name=text(b.name,100), category=text(b.category,60), description=text(b.description,300), price=number(b.price), stock=number(b.stock), emoji=text(b.emoji,8)||"🛍️";
        if (!name || price===null || price<1 || stock===null) return send(res,400,{error:"Product name, price and stock are required."});
        const p={id:id("P"),name,category:category||"General",description,price,stock,emoji};
        d.products.unshift(p); saveStore(d); return send(res,201,{ok:true,product:p});
      }
      if (route === "/api/admin/packages" && req.method === "POST") {
        const b=await readBody(req), name=text(b.name,100), location=text(b.location,100), days=text(b.days,60), description=text(b.description,300), price=number(b.price), emoji=text(b.emoji,8)||"🧭";
        if (!name || !location || !days || price===null || price<1) return send(res,400,{error:"Name, location, duration and price are required."});
        const p={id:id("T"),name,location,days,description,price,emoji};
        d.packages.unshift(p); saveStore(d); return send(res,201,{ok:true,package:p});
      }
      const match=route.match(/^\/api\/admin\/(bookings|hotelBookings|orders)\/([^/]+)$/);
      if (match && req.method==="PATCH") {
        const b=await readBody(req), type=match[1], itemId=match[2];
        const arr=type==="bookings"?d.bookings:(type==="hotelBookings"?(d.hotelBookings||[]):d.orders), item=arr.find(x=>x.id===itemId);
        if (!item) return send(res,404,{error:"Record not found."});
        const allowed=(type==="bookings"||type==="hotelBookings")?["New","Contacted","Confirmed","Cancelled"]:["Awaiting confirmation","Payment confirmed","Processing","Shipped","Completed","Cancelled"];
        if (!allowed.includes(b.status)) return send(res,400,{error:"Invalid status."});
        item.status=b.status; saveStore(d); return send(res,200,{ok:true,item});
      }
      return send(res,404,{error:"Admin endpoint not found."});
    }
    // Serve static files.
    let file = route === "/" ? "index.html" : route.replace(/^\/+/, "");
    file = path.normalize(file);
    if (file.startsWith("..") || path.isAbsolute(file)) return send(res,403,"Forbidden","text/plain");
    const full=path.join(PUBLIC_DIR,file);
    if (!full.startsWith(PUBLIC_DIR+path.sep)) return send(res,403,"Forbidden","text/plain");
    fs.readFile(full,(err,buf)=>{
      if(err) return send(res,404,"Not found","text/plain; charset=utf-8");
      const ext=path.extname(full);
      const types={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml"};
      send(res,200,buf,types[ext]||"application/octet-stream");
    });
  } catch (err) {
    console.error(err);
    if (!res.headersSent) send(res,500,{error:"Server error. Check the terminal for details."});
  }
});

server.listen(PORT,()=>console.log(`Biniyam Travel & Commerce running at http://localhost:${PORT}`));
