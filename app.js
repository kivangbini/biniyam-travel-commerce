const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
let catalog = {products:[], packages:[], settings:{}};
let cart = JSON.parse(sessionStorage.getItem("atc-cart") || "[]");
let activeAdminTab = "bookings";
const money = n => "ETB " + Number(n || 0).toLocaleString("en-ET");
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
async function api(url, options={}) {
  const res = await fetch(url,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});
  const data = await res.json().catch(()=>({error:"Unexpected server response"}));
  if(!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}
function formData(form){return Object.fromEntries(new FormData(form).entries())}
function message(id, text, error=false){const el=$(id);el.textContent=text;el.classList.toggle("error",error)}
let toastTimer;
function toast(text){const el=$("#toast");el.textContent=text;el.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function persistCart(){sessionStorage.setItem("atc-cart",JSON.stringify(cart));renderCart()}
function renderPackages(){
  $("#packagesGrid").innerHTML = catalog.packages.length ? catalog.packages.map((p,i)=>`<article class="package-card"><div class="package-art"><span class="art-tag">${esc(p.days)}</span><span class="big-emoji">${esc(p.emoji||"🧭")}</span></div><div class="package-body"><span class="location">⌖ ${esc(p.location)}</span><h3>${esc(p.name)}</h3><p>${esc(p.description)}</p><div class="package-foot"><b>${money(p.price)}<small>per person · indicative</small></b><button aria-label="Book ${esc(p.name)}" data-book="${esc(p.id)}">↗</button></div></div></article>`).join("") : '<p class="empty-state">No travel packages yet.</p>';
  $("#bookingPackage").innerHTML='<option value="">Select a package</option>'+catalog.packages.map(p=>`<option value="${esc(p.id)}">${esc(p.name)} — ${money(p.price)}</option>`).join("");
}
function renderProducts(){
  const query=$("#productSearch").value.trim().toLowerCase(), category=$("#categoryFilter").value;
  const products=catalog.products.filter(p=>(!category||p.category===category)&&(`${p.name} ${p.description} ${p.category}`).toLowerCase().includes(query));
  $("#productsGrid").innerHTML=products.length?products.map(p=>`<article class="product-card"><div class="product-art"><span>${esc(p.emoji||"🛍️")}</span></div><div class="product-body"><small>${esc(p.category||"General")} · ${Number(p.stock)} in stock</small><h3>${esc(p.name)}</h3><p>${esc(p.description||"Locally selected product.")}</p><div class="product-foot"><b>${money(p.price)}</b><button class="add-cart" data-add="${esc(p.id)}" aria-label="Add ${esc(p.name)} to cart" ${p.stock<1?"disabled":""}>+</button></div></div></article>`).join(""):'<p class="empty-state">No products match your search.</p>';
}
function renderCategoryOptions(){
  const old=$("#categoryFilter").value;
  const categories=[...new Set(catalog.products.map(p=>p.category||"General"))].sort();
  $("#categoryFilter").innerHTML='<option value="">All categories</option>'+categories.map(c=>`<option value="${esc(c)}">${esc(c)}</option>`).join("");
  $("#categoryFilter").value=categories.includes(old)?old:"";
}
function renderCart(){
  const count=cart.reduce((s,x)=>s+x.quantity,0), total=cart.reduce((s,x)=>{const p=catalog.products.find(p=>p.id===x.id);return s+(p?p.price*x.quantity:0)},0);
  $("#cartCount").textContent=count;$("#drawerCount").textContent=`(${count})`;$("#cartTotal").textContent=money(total);
  $("#cartItems").innerHTML=cart.length?cart.map(x=>{const p=catalog.products.find(p=>p.id===x.id);if(!p)return"";return `<div class="cart-line"><div><b>${esc(p.name)}</b><small>${money(p.price)} each · ${money(p.price*x.quantity)}</small></div><div class="quantity-tools"><button data-qty="${esc(p.id)}" data-delta="-1" aria-label="Decrease quantity">−</button><span>${x.quantity}</span><button data-qty="${esc(p.id)}" data-delta="1" aria-label="Increase quantity">+</button></div></div>`}).join(""):'<p class="empty-state">Your cart is empty. Add something you love from the shop.</p>';
  $("#paymentInstructions").textContent=catalog.settings.telebirrInstructions||"Our team will confirm Telebirr payment instructions. Verify merchant details before paying.";
}
function openCart(){$("#cartDrawer").classList.add("open");$("#drawerBackdrop").classList.remove("hidden")}
function closeCart(){$("#cartDrawer").classList.remove("open");$("#drawerBackdrop").classList.add("hidden")}
async function loadPublic(){
  try{catalog=await api("/api/public");renderPackages();renderCategoryOptions();renderProducts();renderCart()}
  catch(e){$("#packagesGrid").innerHTML=`<p class="empty-state">${esc(e.message)}. Please make sure the server is running.</p>`;$("#productsGrid").innerHTML="";}
}
$("#menuToggle").addEventListener("click",()=>$("#mainNav").classList.toggle("open"));
$("#mainNav").addEventListener("click",e=>{if(e.target.closest("a"))$("#mainNav").classList.remove("open")});
$("#cartOpen").addEventListener("click",openCart);$("#shopCart").addEventListener("click",openCart);$("#cartClose").addEventListener("click",closeCart);$("#drawerBackdrop").addEventListener("click",closeCart);
$("#productSearch").addEventListener("input",renderProducts);$("#categoryFilter").addEventListener("change",renderProducts);
document.addEventListener("click",e=>{
  const add=e.target.closest("[data-add]");
  if(add){const p=catalog.products.find(x=>x.id===add.dataset.add);if(!p)return;const item=cart.find(x=>x.id===p.id);if(item){if(item.quantity>=p.stock){toast("No more stock available");return}item.quantity++}else cart.push({id:p.id,quantity:1});persistCart();toast("Added to your cart");return}
  const qty=e.target.closest("[data-qty]");
  if(qty){const item=cart.find(x=>x.id===qty.dataset.qty),p=catalog.products.find(x=>x.id===qty.dataset.qty);if(!item)return;item.quantity+=Number(qty.dataset.delta);if(item.quantity<1)cart=cart.filter(x=>x.id!==item.id);else if(p&&item.quantity>p.stock){item.quantity=p.stock;toast("Stock limit reached")}persistCart();return}
  const book=e.target.closest("[data-book]");
  if(book){$("#bookingPackage").value=book.dataset.book;$("#booking").scrollIntoView({behavior:"smooth"});}
});
$("#bookingForm").addEventListener("submit",async e=>{
  e.preventDefault();message("#bookingMessage","Sending request…");
  const data=formData(e.currentTarget);data.guests=Number(data.guests);
  try{const result=await api("/api/bookings",{method:"POST",body:JSON.stringify(data)});message("#bookingMessage",`${result.message} Reference: ${result.bookingId}`);e.currentTarget.reset();$("#bookingPackage").value=""}
  catch(err){message("#bookingMessage",err.message,true)}
});
$("#hotelForm").addEventListener("submit",async e=>{
  e.preventDefault();message("#hotelMessage","Sending hotel request…");
  const data=formData(e.currentTarget);data.guests=Number(data.guests);data.rooms=Number(data.rooms);
  try{const result=await api("/api/hotels",{method:"POST",body:JSON.stringify(data)});message("#hotelMessage",`${result.message} Reference: ${result.bookingId}`);e.currentTarget.reset()}
  catch(err){message("#hotelMessage",err.message,true)}
});
$("#contactForm").addEventListener("submit",async e=>{
  e.preventDefault();message("#contactMessage","Sending…");
  try{const result=await api("/api/contact",{method:"POST",body:JSON.stringify(formData(e.currentTarget))});message("#contactMessage",result.message);e.currentTarget.reset()}
  catch(err){message("#contactMessage",err.message,true)}
});
$("#checkoutForm").addEventListener("submit",async e=>{
  e.preventDefault();if(!cart.length){message("#checkoutMessage","Your cart is empty.",true);return}
  message("#checkoutMessage","Submitting order…");
  const data=formData(e.currentTarget);data.items=cart.map(x=>({id:x.id,quantity:x.quantity}));
  try{const result=await api("/api/orders",{method:"POST",body:JSON.stringify(data)});message("#checkoutMessage",`${result.message} Order reference: ${result.orderId}. Total: ${money(result.total)}`);cart=[];persistCart();e.currentTarget.reset();toast("Order request submitted")}
  catch(err){message("#checkoutMessage",err.message,true)}
});
async function adminLoginCheck(){
  try{await api("/api/admin/data");$("#adminLoginWrap").classList.add("hidden");$("#adminDashboard").classList.remove("hidden");await loadAdminTab(activeAdminTab)}
  catch{$("#adminLoginWrap").classList.remove("hidden");$("#adminDashboard").classList.add("hidden")}
}
$("#adminLoginForm").addEventListener("submit",async e=>{
  e.preventDefault();message("#adminLoginMessage","Signing in…");
  try{await api("/api/admin/login",{method:"POST",body:JSON.stringify(formData(e.currentTarget))});message("#adminLoginMessage","");e.currentTarget.reset();await adminLoginCheck();toast("Signed in")}
  catch(err){message("#adminLoginMessage",err.message,true)}
});
$("#adminLogout").addEventListener("click",async()=>{try{await api("/api/admin/logout",{method:"POST",body:"{}"})}catch{}$("#adminLoginWrap").classList.remove("hidden");$("#adminDashboard").classList.add("hidden");message("#adminLoginMessage","You have logged out.")});
$$(".tab").forEach(b=>b.addEventListener("click",()=>loadAdminTab(b.dataset.tab)));
function statusSelect(type,item){
  const options=type==="bookings"?["New","Contacted","Confirmed","Cancelled"]:["Awaiting confirmation","Payment confirmed","Processing","Shipped","Completed","Cancelled"];
  return `<select data-status-type="${type}" data-status-id="${esc(item.id)}">${options.map(s=>`<option ${item.status===s?"selected":""}>${esc(s)}</option>`).join("")}</select>`;
}
function adminTable(headers,rows){return rows.length?`<table class="admin-table"><thead><tr>${headers.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.join("")}</tbody></table>`:'<p class="empty-state">Nothing here yet.</p>'}
async function loadAdminTab(tab){
  activeAdminTab=tab;$$(".tab").forEach(b=>b.classList.toggle("active",b.dataset.tab===tab));
  const root=$("#adminContent");root.innerHTML='<p class="loading">Loading admin data…</p>';
  try{
    const d=await api("/api/admin/data");
    const totalSales=(d.orders||[]).reduce((sum,o)=>sum+Number(o.total||0),0);
    const pendingOrders=(d.orders||[]).filter(o=>o.status==="Awaiting confirmation").length;
    const pendingBookings=(d.bookings||[]).filter(b=>b.status==="New").length+(d.hotelBookings||[]).filter(b=>b.status==="New").length;
    $("#adminStats").innerHTML=`<div class="stat-card"><small>Shop orders</small><strong>${(d.orders||[]).length}</strong><span>All recorded orders</span></div><div class="stat-card"><small>Order value</small><strong>${money(totalSales)}</strong><span>Not necessarily paid</span></div><div class="stat-card"><small>Awaiting payment check</small><strong>${pendingOrders}</strong><span>Verify manually</span></div><div class="stat-card"><small>New booking requests</small><strong>${pendingBookings}</strong><span>Travel + hotel</span></div>`;
    if(tab==="bookings")root.innerHTML=adminTable(["Reference / Date","Customer","Trip","Travel date","Guests","Status"],d.bookings.map(x=>`<tr><td>${esc(x.id)}<br><small>${esc(new Date(x.createdAt).toLocaleString())}</small></td><td>${esc(x.name)}<br>${esc(x.email)}<br>${esc(x.phone)}</td><td>${esc(x.packageName)}<br><small>${esc(x.note)}</small></td><td>${esc(x.date)}</td><td>${x.guests}</td><td>${statusSelect("bookings",x)}</td></tr>`));
    if(tab==="hotels")root.innerHTML=adminTable(["Reference / Date","Customer","Hotel / area","Stay","Guests / rooms","Status"],(d.hotelBookings||[]).map(x=>`<tr><td>${esc(x.id)}<br><small>${esc(new Date(x.createdAt).toLocaleString())}</small></td><td>${esc(x.name)}<br>${esc(x.email)}<br>${esc(x.phone)}</td><td>${esc(x.hotel)}<br><small>${esc(x.note)}</small></td><td>${esc(x.checkIn)} – ${esc(x.checkOut)}</td><td>${x.guests} guests / ${x.rooms} rooms</td><td>${statusSelect("hotelBookings",x)}</td></tr>`));
    if(tab==="orders")root.innerHTML=adminTable(["Reference / Date","Customer","Items","Total / Payment","Status"],d.orders.map(x=>`<tr><td>${esc(x.id)}<br><small>${esc(new Date(x.createdAt).toLocaleString())}</small></td><td>${esc(x.name)}<br>${esc(x.email)}<br>${esc(x.phone)}<br>${esc(x.address)}</td><td>${x.items.map(i=>`${esc(i.name)} × ${i.quantity}`).join("<br>")}</td><td>${money(x.total)}<br><small>${esc(x.paymentMethod||"Not selected")} · manual confirmation</small></td><td>${statusSelect("orders",x)}</td></tr>`));
    if(tab==="products")root.innerHTML=adminTable(["Product","Category","Price","Stock"],d.products.map(x=>`<tr><td>${esc(x.emoji)} ${esc(x.name)}<br><small>${esc(x.description)}</small></td><td>${esc(x.category)}</td><td>${money(x.price)}</td><td>${x.stock}</td></tr>`));
    if(tab==="packages")root.innerHTML=adminTable(["Package","Location","Duration","Price"],d.packages.map(x=>`<tr><td>${esc(x.emoji)} ${esc(x.name)}<br><small>${esc(x.description)}</small></td><td>${esc(x.location)}</td><td>${esc(x.days)}</td><td>${money(x.price)}</td></tr>`));
    if(tab==="messages")root.innerHTML=adminTable(["Reference / Date","Sender","Message"],d.messages.map(x=>`<tr><td>${esc(x.id)}<br><small>${esc(new Date(x.createdAt).toLocaleString())}</small></td><td>${esc(x.name)}<br>${esc(x.email)}</td><td>${esc(x.message)}</td></tr>`));
  }catch(err){root.innerHTML=`<p class="form-message error">${esc(err.message)}. Please sign in again.</p>`;adminLoginCheck()}
}
$("#adminContent").addEventListener("change",async e=>{
  const el=e.target.closest("[data-status-type]");if(!el)return;
  try{await api(`/api/admin/${el.dataset.statusType}/${encodeURIComponent(el.dataset.statusId)}`,{method:"PATCH",body:JSON.stringify({status:el.value})});toast("Status updated")}
  catch(err){toast(err.message);await loadAdminTab(activeAdminTab)}
});
$("#addProductForm").addEventListener("submit",async e=>{
  e.preventDefault();const d=formData(e.currentTarget);d.price=Number(d.price);d.stock=Number(d.stock);
  try{await api("/api/admin/products",{method:"POST",body:JSON.stringify(d)});message("#addProductMessage","Product added.");e.currentTarget.reset();await loadPublic();await loadAdminTab("products")}
  catch(err){message("#addProductMessage",err.message,true)}
});
$("#addPackageForm").addEventListener("submit",async e=>{
  e.preventDefault();const d=formData(e.currentTarget);d.price=Number(d.price);
  try{await api("/api/admin/packages",{method:"POST",body:JSON.stringify(d)});message("#addPackageMessage","Travel package added.");e.currentTarget.reset();await loadPublic();await loadAdminTab("packages")}
  catch(err){message("#addPackageMessage",err.message,true)}
});
$("#year").textContent=new Date().getFullYear();
loadPublic();adminLoginCheck();