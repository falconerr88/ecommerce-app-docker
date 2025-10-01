from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import json
import logging
from datetime import datetime
from fastapi.staticfiles import StaticFiles
import os

from database import get_db, Product, CartItem, Order, redis_client
from models import (
    ProductBase, Product as ProductModel,
    CartItemCreate, CartItem as CartItemModel,
    OrderCreate, Order as OrderModel,
    HealthCheck
)
from config import settings

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='{"timestamp": "%(asctime)s", "level": "%(levelname)s", "message": "%(message)s"}'
)
logger = logging.getLogger(__name__)

# FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="E-commerce API built with FastAPI and Kubernetes best practices"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify actual domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Static files (e.g., product images)
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
app.mount("/static", StaticFiles(directory=os.path.join(BASE_DIR, "static")), name="static")

# /health -> solo dice que la app está viva
@app.get("/health", response_model=HealthCheck)
async def health_check():
    return HealthCheck(
        status="ok",
        timestamp=datetime.utcnow(),
        version="1.0.0",
        database="skipped",  # no se valida acá
        redis="skipped"
    )
# Readiness check endpoint
@app.get("/ready", response_model=HealthCheck)
async def readiness_check():
    """Readiness check endpoint for Kubernetes probes"""
    return HealthCheck(
        status="ok",
        timestamp=datetime.utcnow(),
        version="1.0.0",
        database="healthy",  # opcional: podés hacer chequeos reales como en /health
        redis="healthy"
    )


    try:
        db = next(get_db())
        db.execute("SELECT 1")
    except Exception as e:
        logger.error(f"Database health check failed: {str(e)}")
        db_status = "unhealthy"


    try:
        redis_client.ping()
    except Exception as e:
        logger.error(f"Redis health check failed: {str(e)}")
        redis_status = "unhealthy"

    return HealthCheck(
        status="ok",
        timestamp=datetime.utcnow(),
        version="1.0.0",
        database=db_status,
        redis=redis_status
    )




# Products endpoints
@app.get("/products", response_model=List[ProductModel])
async def get_products(skip: int = 0, limit: int = 10, db: Session = Depends(get_db)):
    """Get all products with caching"""
    cache_key = f"products:{skip}:{limit}"
    
    # Try to get from cache first
    try:
        cached_products = redis_client.get(cache_key)
        if cached_products:
            logger.info("Products retrieved from cache")
            return json.loads(cached_products)
    except Exception as e:
        logger.warning(f"Cache retrieval failed: {str(e)}")
    
    # Get from database
    products = db.query(Product).offset(skip).limit(limit).all()
    products_dict = [
    {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "price": p.price,
        "stock": p.stock,
        "image_url": p.image_url,
        "created_at": p.created_at.isoformat() if p.created_at else None
    }
    for p in products
    ]
    
    # Cache the result
    try:
        redis_client.setex(cache_key, 300, json.dumps(products_dict))  # 5 min cache
        logger.info("Products cached successfully")
    except Exception as e:
        logger.warning(f"Cache storage failed: {str(e)}")
    
    logger.info(f"Retrieved {len(products)} products from database")
    return products_dict

@app.post("/products", response_model=ProductModel)
async def create_product(product: ProductBase, db: Session = Depends(get_db)):
    """Create a new product"""
    db_product = Product(**product.dict())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    # Clear products cache
    try:
        keys = redis_client.keys("products:*")
        if keys:
            redis_client.delete(*keys)
    except Exception as e:
        logger.warning(f"Cache clearing failed: {str(e)}")
    
    logger.info(f"Created new product: {db_product.name}")
    return db_product

# Cart endpoints
@app.post("/cart", response_model=CartItemModel)
async def add_to_cart(cart_item: CartItemCreate, db: Session = Depends(get_db)):
    """Add item to cart"""
    # Check if product exists
    product = db.query(Product).filter(Product.id == cart_item.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check if item already in cart
    existing_item = db.query(CartItem).filter(
        CartItem.user_id == cart_item.user_id,
        CartItem.product_id == cart_item.product_id
    ).first()
    
    if existing_item:
        existing_item.quantity += cart_item.quantity
        db.commit()
        db.refresh(existing_item)
        logger.info(f"Updated cart item quantity for user {cart_item.user_id}")
        return existing_item
    else:
        db_cart_item = CartItem(**cart_item.dict())
        db.add(db_cart_item)
        db.commit()
        db.refresh(db_cart_item)
        logger.info(f"Added new item to cart for user {cart_item.user_id}")
        return db_cart_item

@app.get("/cart/{user_id}", response_model=List[CartItemModel])
async def get_cart(user_id: str, db: Session = Depends(get_db)):
    """Get user's cart"""
    cart_items = db.query(CartItem).filter(CartItem.user_id == user_id).all()
    logger.info(f"Retrieved cart for user {user_id}: {len(cart_items)} items")
    return cart_items

# Orders endpoints
@app.post("/orders", response_model=OrderModel)
async def create_order(order: OrderCreate, db: Session = Depends(get_db)):
    """Create a new order"""
    # Calculate total
    total_amount = 0
    for item in order.items:
        product = db.query(Product).filter(Product.id == item.product_id).first()
        if product:
            total_amount += product.price * item.quantity
    
    # Create order
    db_order = Order(
        user_id=order.user_id,
        total_amount=total_amount,
        status="pending"
    )
    db.add(db_order)
    db.commit()
    db.refresh(db_order)
    
    # Clear user's cart
    db.query(CartItem).filter(CartItem.user_id == order.user_id).delete()
    db.commit()
    
    logger.info(f"Created order {db_order.id} for user {order.user_id}, total: ${total_amount}")
    return db_order

@app.get("/orders/{user_id}", response_model=List[OrderModel])
async def get_orders(user_id: str, db: Session = Depends(get_db)):
    """Get user's orders"""
    orders = db.query(Order).filter(Order.user_id == user_id).all()
    logger.info(f"Retrieved {len(orders)} orders for user {user_id}")
    return orders

# Initialize with sample data
@app.on_event("startup")
async def startup_event():
    """Initialize database with sample data"""
    db = next(get_db())
    
    # Check if we already have products
    existing_products = db.query(Product).count()
    if existing_products == 0:
        sample_products = [
            Product(name="Laptop Gaming", description="High-performance gaming laptop", price=1299.99, stock=10, image_url="/static/images/laptop-gaming.jpg"),
            Product(name="Smartphone", description="Latest model smartphone", price=799.99, stock=25, image_url="/static/images/smartphone.jpg"),
            Product(name="Headphones", description="Noise-cancelling wireless headphones", price=299.99, stock=50, image_url="/static/images/headphones.jpg"),
            Product(name="Smart Watch", description="Fitness tracking smart watch", price=399.99, stock=30, image_url="/static/images/smartwatch.jpg"),
            Product(name="Tablet", description="10-inch tablet for productivity", price=549.99, stock=20, image_url="/static/images/tablet.jpg"),
        ]
        
        for product in sample_products:
            db.add(product)
        
        db.commit()
        logger.info("Sample products added to database")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        access_log=True
    )