document.addEventListener('contextmenu', event => event.preventDefault());

let products = [];
let cart = [];
let currentFilter = [];

const excelUrl = "https://raw.githubusercontent.com/ServiTico/MarketCR/main/data/listV1.xlsx";

async function loadProductsFromExcel(url) {
  try {
    const res = await fetch(url);
    const data = await res.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(data), { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    const categoriesSet = new Set();
    products = rows.map(row => {
      categoriesSet.add(row.Categoria);
      return {
        name: row.Nombre,
        description: row.Descripción || "",
        price: Number(row.Precio),
        available: Number(row.Cantidad),
        category: row.Categoria
      };
    });

    currentFilter = [...products];
    renderCategoryButtons(Array.from(categoriesSet));
    renderProducts(currentFilter);
  } catch (err) {
    console.error("Error cargando productos desde Excel:", err);
  }
}

function renderCategoryButtons(categories) {
  const container = document.getElementById("category-buttons");
  container.innerHTML = `<button class="btn btn-outline-secondary category-filter active" data-category="todos">Todos</button>`;
  categories.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "btn btn-outline-secondary category-filter";
    btn.setAttribute("data-category", cat);
    btn.textContent = cat;
    container.appendChild(btn);
  });
  document.querySelectorAll(".category-filter").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelector(".category-filter.active")?.classList.remove("active");
      btn.classList.add("active");
      const cat = btn.getAttribute("data-category");
      currentFilter = (cat === "todos") ? [...products] : products.filter(p => p.category === cat);
      renderProducts(currentFilter);
    });
  });
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/ñ/g, 'n')
    .replace(/\s+/g, '_')
    .replace(/[^\w_]/g, '');
}

function renderProducts(filtered = products) {
  const productList = document.getElementById("product-list");
  productList.innerHTML = "";
  if (filtered.length === 0) {
    productList.innerHTML = `<div class="col"><p class="text-center">No se encontraron productos.</p></div>`;
    return;
  }
  filtered.forEach(product => {
    const folder = normalizeName(product.name);
    const carouselId = `carousel-${folder}`;
    const images = [1, 2, 3].map(i => `img/${folder}/${i}.png`);

    const col = document.createElement("div");
    col.className = "col";
    col.innerHTML = `
      <div class="card h-100 product-card">
        <div id="${carouselId}" class="carousel slide" data-bs-ride="carousel">
          <div class="carousel-inner">
            ${images.map((src, idx) => `
              <div class="carousel-item ${idx === 0 ? "active" : ""}">
                <img src="${src}" class="d-block w-100" alt="${product.name}"
                  onerror="this.onerror=null;this.src='img/default.png';">
              </div>
            `).join('')}
          </div>
          <button class="carousel-control-prev" type="button" data-bs-target="#${carouselId}" data-bs-slide="prev">
            <span class="carousel-control-prev-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Anterior</span>
          </button>
          <button class="carousel-control-next" type="button" data-bs-target="#${carouselId}" data-bs-slide="next">
            <span class="carousel-control-next-icon" aria-hidden="true"></span>
            <span class="visually-hidden">Siguiente</span>
          </button>
        </div>
        <div class="card-body">
          <h5 class="card-title">${product.name}</h5>
          <p class="card-text text-muted small">${product.description}</p>
          <p class="card-text">₡${product.price.toLocaleString()}</p>
          <p class="text-muted small">Disponibles: ${product.available}</p>
          <button class="btn btn-success w-100" onclick="addToCart('${product.name}')" ${product.available === 0 ? 'disabled' : ''}>Agregar al carrito</button>
        </div>
      </div>`;
    productList.appendChild(col);
  });
}

function addToCart(name) {
  const product = products.find(p => p.name === name);
  if (!product || product.available === 0) return;
  const existing = cart.find(p => p.name === name);
  if (existing) existing.quantity++;
  else cart.push({ ...product, quantity: 1 });
  product.available--;
  updateCartUI();
  renderProducts(currentFilter);
}

function removeFromCart(name) {
  const item = cart.find(p => p.name === name);
  if (!item) return;
  const product = products.find(p => p.name === name);
  product.available += item.quantity;
  cart = cart.filter(p => p.name !== name);
  updateCartUI();
  renderProducts(currentFilter);
}

function updateCartUI() {
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");
  const cartCount = document.getElementById("cart-count");
  cartItems.innerHTML = "";
  let total = 0, count = 0;
  cart.forEach(p => {
    total += p.price * p.quantity;
    count += p.quantity;
    const li = document.createElement("li");
    li.className = "list-group-item d-flex justify-content-between align-items-center";
    li.innerHTML = `
      <div>
        <h6>${p.name}</h6>
        <small>Cantidad: ${p.quantity}</small>
      </div>
      <div>
        <span>₡${(p.price * p.quantity).toLocaleString()}</span>
        <button class="btn btn-sm btn-danger ms-2" onclick="removeFromCart('${p.name}')">✕</button>
      </div>`;
    cartItems.appendChild(li);
  });
  cartTotal.textContent = total.toLocaleString();
  cartCount.textContent = count;
}

document.getElementById("search-input").addEventListener("input", () => {
  const term = document.getElementById("search-input").value.trim().toLowerCase();
  const filtered = term === "" ? currentFilter : currentFilter.filter(p => p.name.toLowerCase().includes(term));
  renderProducts(filtered);
});

document.getElementById("checkout-form").addEventListener("submit", e => {
  e.preventDefault();
  const nombre = document.getElementById("nombre").value.trim();
  const telefono = document.getElementById("telefono").value.trim();
  if (!nombre || !telefono || cart.length === 0) {
    alert("Por favor complete los campos y agregue productos al carrito.");
    return;
  }
  const resumen = cart.map(p => `${p.name} x${p.quantity}`).join(", ");
  const total = cart.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const params = { nombre, telefono, productos: resumen, total: `₡${total.toLocaleString()}` };

  emailjs.send('service_7u7388h', 'template_ryisoem', params)
    .then(() => {
      alert("Pedido enviado con éxito");
      cart = [];
      updateCartUI();
      renderProducts(currentFilter);
      document.getElementById("checkout-form").reset();
      bootstrap.Modal.getInstance(document.getElementById("checkoutModal")).hide();
    })
    .catch(err => alert("Error al enviar el pedido"));
});

document.getElementById("checkoutModal").addEventListener("show.bs.modal", () => {
  const resumenBox = document.getElementById("checkout-summary");
  if (cart.length === 0) {
    resumenBox.innerHTML = "<p class='text-danger'>El carrito está vacío.</p>";
  } else {
    resumenBox.innerHTML = cart.map(p => `<p>${p.name} x${p.quantity} – ₡${(p.price * p.quantity).toLocaleString()}</p>`).join('');
  }
});

// Inicia carga
loadProductsFromExcel(excelUrl);
