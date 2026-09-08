// 1. DATABASE SETUP
const API_URL = "https://script.google.com/macros/s/AKfycbzfw62mXI3NYMlXQYHtWplvC2-EfAXP78dlGe0byMNx1f61Mvv741VsSeGAWS0hVC9v/exec";
let inventoryData = [];
let ordersData = [];

// 2. FETCH LIVE DATA FROM GOOGLE SHEETS
async function loadGoogleSheetData() {
    document.getElementById('inventoryBody').innerHTML = '<tr><td colspan="6">Loading live data from Google Sheets...</td></tr>';
    
    try {
        const response = await fetch(API_URL);
        const data = await response.json(); 
        
        // Map Inventory Data
        inventoryData = data.inventory.map(row => {
            let rawPrice = String(row.Price || row.price || "").replace(/[^0-9.-]+/g,"");
            let rawStock = row.Stock || row.stock || row.Available || row.available || 0;
            
            return {
                item: row.Item || row.item,
                spec: row.Spec || row.spec || row["Size / specification"],
                category: row.Category || row.category,
                price: Number(rawPrice) || 0,
                stock: Number(rawStock) || 0
            };
        });

        // Map Orders Data
        ordersData = data.orders.map(row => {
            let parsedItems = [];
            try {
                // Reads the JSON array we saved in Column F
                parsedItems = JSON.parse(row.RawItems || "[]");
            } catch(e) {
                console.warn("Could not parse items for order", row.OrderID);
            }

            return {
                orderId: row.OrderID,
                items: parsedItems,
                payment: row.Payment,
                total: Number(String(row.Total).replace(/[^0-9.-]+/g,"")) || 0
            };
        });
        
        renderTables();
        populateDropdowns();
    } catch (error) {
        document.getElementById('inventoryBody').innerHTML = '<tr><td colspan="6" style="color: red;">Failed to load data. Check console.</td></tr>';
        console.error("Fetch error:", error);
    }
}

// 3. TAB SWITCHING LOGIC
window.switchTab = function(tabId, btnElement) {
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btnElement.classList.add('active');
};

// 4. RENDER ALL TABLES FROM DATA
function renderTables() {
    const storeBody = document.getElementById('inventoryBody');
    const managementBody = document.getElementById('managementBody');
    const ordersBody = document.getElementById('ordersBody');
    
    storeBody.innerHTML = ''; managementBody.innerHTML = ''; ordersBody.innerHTML = '';

    inventoryData.forEach(row => {
        let statusClass = row.stock <= 10 ? 'low-stock' : 'in-stock';
        let statusText = row.stock <= 10 ? 'Low stock' : 'In stock';
        if (row.stock <= 0) { statusClass = 'low-stock'; statusText = 'Out of stock'; row.stock = 0; }

        storeBody.innerHTML += `
            <tr>
                <td>${row.item}</td><td>${row.spec}</td><td>${row.category}</td>
                <td>₱${row.price.toFixed(2)}</td><td>${row.stock}</td><td class="${statusClass}">${statusText}</td>
            </tr>`;
        managementBody.innerHTML += `
            <tr><td>${row.item}</td><td>${row.spec}</td><td><strong>${row.stock}</strong></td></tr>`;
    });
    
    ordersData.forEach((order) => {
        ordersBody.innerHTML += `
            <tr>
                <td>${order.orderId}</td>
                <td>${order.items.map(i => `${i.qty}x ${i.item} (${i.spec})`).join('<br>')}</td>
                <td>${order.payment}</td>
                <td>₱${order.total.toFixed(2)}</td>
                <td><button onclick='handleReturn("${order.orderId}")' style="background:red; color:white; border:none; padding:5px; cursor:pointer;">Return</button></td>
            </tr>`;
    });
}

// 5. AUTO-POPULATE FORM DROPDOWNS
function populateDropdowns() {
    const uniqueItems = [...new Set(inventoryData.map(i => i.item))];
    document.querySelectorAll('.item-select').forEach(select => {
        if(select.options.length === 1) { 
            uniqueItems.forEach(item => {
                select.innerHTML += `<option value="${item}">${item}</option>`;
            });
        }
    });
}

// 6. HANDLE FORM CHANGES & LIMIT STOCK
document.getElementById('orderForm').addEventListener('change', function(e) {
    if(e.target.classList.contains('item-select')) {
        const item = e.target.value;
        const specSelect = e.target.closest('.item-block').querySelector('.spec-select');
        specSelect.innerHTML = '<option value="">Choose a specification</option>';
        
        inventoryData.filter(i => i.item === item).forEach(s => {
            const stockNote = s.stock <= 0 ? " (SOLD OUT)" : ` (${s.stock} left)`;
            specSelect.innerHTML += `<option value="${s.spec}" ${s.stock <= 0 ? 'disabled' : ''}>${s.spec} - ₱${s.price} ${stockNote}</option>`;
        });
    }
    updateTotals();
});

document.getElementById('orderForm').addEventListener('input', function(e) {
    if (e.target.classList.contains('qty-input')) {
        const block = e.target.closest('.item-block');
        const item = block.querySelector('.item-select').value;
        const spec = block.querySelector('.spec-select').value;
        const product = inventoryData.find(i => i.item === item && i.spec === spec);

        if (product && parseInt(e.target.value) > product.stock) {
            alert(`Only ${product.stock} available in stock!`);
            e.target.value = product.stock; // Force quantity back to max available
        }
    }
    updateTotals();
});

function updateTotals() {
    let grandTotal = 0;
    document.querySelectorAll('.item-block').forEach(block => {
        const item = block.querySelector('.item-select').value;
        const spec = block.querySelector('.spec-select').value;
        const qty = parseInt(block.querySelector('.qty-input').value) || 1;
        
        const product = inventoryData.find(i => i.item === item && i.spec === spec);
        const price = product ? product.price : 0;
        const lineTotal = price * qty;
        
        grandTotal += lineTotal;
        block.querySelector('p').innerHTML = `Unit price: ₱${price.toFixed(2)} &nbsp;|&nbsp; <strong>Line total: ₱${lineTotal.toFixed(2)}</strong>`;
    });
    document.getElementById('grandTotalDisplay').textContent = `₱${grandTotal.toFixed(2)}`;
}

// 7. ADD / REMOVE ITEMS
document.getElementById('addItemBtn').addEventListener('click', () => {
    const firstBlock = document.querySelector('.item-block');
    const newBlock = firstBlock.cloneNode(true);
    newBlock.querySelector('.item-select').selectedIndex = 0;
    newBlock.querySelector('.spec-select').innerHTML = '<option value="">Choose a specification</option>';
    newBlock.querySelector('.qty-input').value = 1;
    newBlock.querySelector('p').innerHTML = `Unit price: ₱0.00 &nbsp;|&nbsp; <strong>Line total: ₱0.00</strong>`;
    newBlock.querySelector('.btn-remove').style.display = 'block';
    
    document.getElementById('itemsContainer').appendChild(newBlock);
    updateItemTitles();
});

document.getElementById('itemsContainer').addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-remove')) {
        e.target.closest('.item-block').remove();
        updateTotals();
        updateItemTitles();
    }
});

function updateItemTitles() {
    document.querySelectorAll('.item-title').forEach((title, index) => {
        title.textContent = `Item ${index + 1}`;
    });
}

// 8. SUBMIT ORDER AND RETURN LOGIC
document.getElementById('orderForm').addEventListener('submit', (e) => {
    e.preventDefault();
    let orderItems = [];
    let grandTotal = 0;
    
    document.querySelectorAll('.item-block').forEach(block => {
        const item = block.querySelector('.item-select').value;
        const spec = block.querySelector('.spec-select').value;
        const qty = parseInt(block.querySelector('.qty-input').value) || 1;
        const product = inventoryData.find(i => i.item === item && i.spec === spec);
        
        if (product && qty > 0 && qty <= product.stock) {
            orderItems.push({ item, spec, qty });
            grandTotal += product.price * qty;
        }
    });

    if(orderItems.length === 0) return alert("Invalid items or out of stock.");
    const payment = document.querySelector('input[name="payment"]:checked').value;
    
    // Temporary UI Update while server processes
    const tempOrderId = "Processing...";
    ordersData.push({ orderId: tempOrderId, items: orderItems, payment, total: grandTotal });
    orderItems.forEach(oi => {
        let invItem = inventoryData.find(i => i.item === oi.item && i.spec === oi.spec);
        if(invItem) invItem.stock -= oi.qty;
    });
    renderTables();

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "new_order", items: orderItems, total: grandTotal, payment: payment }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
    })
    .then(response => response.json())
    .then(data => {
        if(data.status === "success") {
            // Update the temporary ID with the real one from Google Sheets
            ordersData[ordersData.length - 1].orderId = data.orderId;
            renderTables();
            alert("Order saved and inventory updated!");
        }
    });
    
    document.getElementById('orderForm').reset();
    document.querySelectorAll('.item-block').forEach((block, idx) => { if(idx > 0) block.remove(); });
});

// RETURN LOGIC
window.handleReturn = function(orderId) {
    if(!confirm("Are you sure you want to return this order and restock items?")) return;
    
    const orderIndex = ordersData.findIndex(o => o.orderId === orderId);
    if(orderIndex === -1) return;
    
    const orderToReturn = ordersData[orderIndex];
    
    // Optimistic UI Update: add stock back locally and remove order from array
    orderToReturn.items.forEach(oi => {
        let invItem = inventoryData.find(i => i.item === oi.item && i.spec === oi.spec);
        if(invItem) invItem.stock += oi.qty;
    });
    ordersData.splice(orderIndex, 1);
    renderTables();

    fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({ action: "return_order", orderId: orderId, items: orderToReturn.items }),
        headers: { "Content-Type": "text/plain;charset=utf-8" }
    })
    .then(res => res.json())
    .then(data => {
        if(data.status === "success") alert("Order returned successfully. Inventory restocked.");
    });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', loadGoogleSheetData);