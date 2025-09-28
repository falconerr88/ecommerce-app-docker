from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class ProductBase(BaseModel):
    name: str
    description: str
    price: float
    stock: int
    image_url: Optional[str] = None

class Product(ProductBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class CartItemCreate(BaseModel):
    user_id: str
    product_id: int
    quantity: int

class CartItem(BaseModel):
    id: int
    user_id: str
    product_id: int
    quantity: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    user_id: str
    items: List[CartItemCreate]

class Order(BaseModel):
    id: int
    user_id: str
    total_amount: float
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class HealthCheck(BaseModel):
    status: str
    timestamp: datetime
    version: str
    database: str
    redis: str