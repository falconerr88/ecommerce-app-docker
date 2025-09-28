// App configuration
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:8000' 
    : 'http://backend-service:8000';

// Global state
let products = [];
let cart = [];
let currentUserId = 'user-' + Math.random().toString(36).substr(2, 9);

// DOM elements
const productGrid = document.getElementById('products-grid');
const cartSidebar = document.getElementById('cart-sidebar');
const overlay = document.getElementById('overlay');
const cartCount = document.getElementById('cart-count');
const cartItems = document.getElementById('cart-items');
const cartTotal = document.getElementById('cart-total');
const loading = document.getElementById('loading');
const apiStatus = document.getElementById('api-status');

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    checkApiStatus();
    loadProducts();
    loadCart();
    
    // Check API status periodically
    setInterval(checkApiStatus, 30000); // Every 30 seconds
});

// API Status Check
async function checkApiStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const status = await response.json();
        
        updateStatusIndicator('connected', 'API Connected');
    } catch (error) {
        console.error('API health check failed:', error);
        updateStatusIndicator('error', 'API Connection Failed');
    }
}

function updateStatusIndicator(status, message) {
    const statusDot = apiStatus.querySelector('.status-dot');
    const statusText = apiStatus.querySelector('span:last-child');
    
    statusDot.className = `status-dot ${status}`;
    statusText.textContent = message;
}

// Load products from API
async function loadProducts() {
    try {
        showLoading(true);
        
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        products = await response.json();
        renderProducts();
        updateStatusIndicator('connected', 'API Connected');
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please check your connection.');
        updateStatusIndicator('error', 'Failed to load products');
    } finally {
        showLoading(false);
    }
}

// Render products
function renderProducts() {
    if (!products.length) {
        productGrid.innerHTML = '<p class="no-products">No products available</p>';
        return;
    }

    productGrid.innerHTML = products.map(product => `
        <div class="product-card fade-in">
            <div class="product-image">
                ${product.image_url ? 
                    `<img src="${product.image_url}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">` :
                    '🛍️'
                }
            </div>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="product-price">$${product.price.toFixed(2)}</div>
            <div class="product-stock">Stock: ${product.stock}</div>
            <button 
                class="add-to-cart-btn" 
                onclick="addToCart(${product.id})"
                ${product.stock === 0 ? 'disabled' : ''}
            >
                ${product.stock === 0 ? 'Out of Stock' : 'Add to Cart'}
            </button>
        </div>
    `).join('');
}

// Add item to cart
async function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    try {
        const response = await fetch(`${API_BASE_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUserId,
                product_id: productId,
                quantity: 1
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        await loadCart();
        showNotification(`${product.name} added to cart!`);
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        showNotification('Failed to add item to cart', 'error');
    }
}

// Load cart from API
async function loadCart() {
    try {
        const response = await fetch(`${API_BASE_URL}/cart/${currentUserId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        cart = await response.json();
        renderCart();
        updateCartCount();
        
    } catch (error) {
        console.error('Error loading cart:', error);
        cart = [];
        renderCart();
        updateCartCount();
    }
}

// Render cart items
function renderCart() {
    if (!cart.length) {
        cartItems.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        updateCartTotal();
        return;
    }

    cartItems.innerHTML = cart.map(item => {
        const product = products.find(p => p.id === item.product_id);
        if (!product) return '';
        
        return `
            <div class="cart-item cart-item-enter">
                <div class="product-image" style="width:60px;height:60px;flex-shrink:0;">
                    ${product.image_url ? 
                        `<img src="${product.image_url}" alt="${product.name}" style="width:100%;height:100%;object-fit:cover;border-radius:5px;">` :
                        '🛍️'
                    }
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${product.name}</div>
                    <div class="cart-item-price">${product.price.toFixed(2)}</div>
                    <div class="quantity-controls">
                        <button class="quantity-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity - 1})">-</button>
                        <span class="quantity">${item.quantity}</span>
                        <button class="quantity-btn" onclick="updateCartItemQuantity(${item.id}, ${item.quantity + 1})">+</button>
                        <button class="quantity-btn" onclick="removeFromCart(${item.id})" style="background:#e74c3c;margin-left:0.5rem;">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    updateCartTotal();
}

// Update cart item quantity
async function updateCartItemQuantity(cartItemId, newQuantity) {
    if (newQuantity <= 0) {
        await removeFromCart(cartItemId);
        return;
    }

    // For now, we'll implement this by removing and re-adding
    // In a real app, you'd have a PATCH endpoint
    const cartItem = cart.find(item => item.id === cartItemId);
    if (!cartItem) return;

    await removeFromCart(cartItemId);
    
    // Add the new quantity
    for (let i = 0; i < newQuantity; i++) {
        await fetch(`${API_BASE_URL}/cart`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUserId,
                product_id: cartItem.product_id,
                quantity: 1
            })
        });
    }
    
    await loadCart();
}

// Remove item from cart
async function removeFromCart(cartItemId) {
    try {
        // For this demo, we'll implement client-side removal
        // In a real app, you'd have a DELETE endpoint
        cart = cart.filter(item => item.id !== cartItemId);
        renderCart();
        updateCartCount();
        showNotification('Item removed from cart');
        
    } catch (error) {
        console.error('Error removing from cart:', error);
        showNotification('Failed to remove item', 'error');
    }
}

// Update cart count
function updateCartCount() {
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    cartCount.textContent = totalItems;
}

// Update cart total
function updateCartTotal() {
    const total = cart.reduce((sum, item) => {
        const product = products.find(p => p.id === item.product_id);
        return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    
    cartTotal.textContent = total.toFixed(2);
    
    const checkoutBtn = document.getElementById('checkout-btn');
    checkoutBtn.disabled = total === 0;
}

// Toggle cart sidebar
function toggleCart() {
    cartSidebar.classList.toggle('open');
    overlay.classList.toggle('active');
}

// Checkout
async function checkout() {
    if (!cart.length) return;

    try {
        const orderItems = cart.map(item => ({
            user_id: currentUserId,
            product_id: item.product_id,
            quantity: item.quantity
        }));

        const response = await fetch(`${API_BASE_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user_id: currentUserId,
                items: orderItems
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const order = await response.json();
        
        // Clear cart and close sidebar
        cart = [];
        renderCart();
        updateCartCount();
        toggleCart();
        
        showNotification(`Order #${order.id} placed successfully! Total: ${order.total_amount.toFixed(2)}`, 'success');
        
    } catch (error) {
        console.error('Error during checkout:', error);
        showNotification('Checkout failed. Please try again.', 'error');
    }
}

// Utility functions
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    productGrid.style.display = show ? 'none' : 'grid';
}

function showError(message) {
    productGrid.innerHTML = `<p class="error-message" style="color:#e74c3c;text-align:center;padding:2rem;">${message}</p>`;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 5px;
        color: white;
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        max-width: 300px;
    `;
    
    switch(type) {
        case 'success':
            notification.style.backgroundColor = '#27ae60';
            break;
        case 'error':
            notification.style.backgroundColor = '#e74c3c';
            break;
        default:
            notification.style.backgroundColor = '#3498db';
    }
    
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease-in forwards';
        setTimeout(() => document.body.removeChild(notification), 300);
    }, 3000);
}

// Add CSS animations for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            opacity: 0;
            transform: translateX(100%);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
    
    @keyframes slideOutRight {
        from {
            opacity: 1;
            transform: translateX(0);
        }
        to {
            opacity: 0;
            transform: translateX(100%);
        }
    }
    
    .empty-cart {
        text-align: center;
        color: #7f8c8d;
        padding: 2rem;
        font-style: italic;
    }
    
    .error-message {
        grid-column: 1 / -1;
    }
`;
document.head.appendChild(style);