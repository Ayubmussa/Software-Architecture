from pydantic import BaseModel, Field, condecimal, conint
from datetime import datetime


class ProductBase(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = Field(None, max_length=1024)
    category: str | None = Field(None, max_length=255)
    price: condecimal(max_digits=10, decimal_places=2)
    stock: conint(ge=0)
    image_url: str | None = Field(None, max_length=512)


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = Field(None, max_length=1024)
    category: str | None = Field(None, max_length=255)
    price: condecimal(max_digits=10, decimal_places=2) | None = None
    stock: conint(ge=0) | None = None
    image_url: str | None = Field(None, max_length=512)


class ProductOut(ProductBase):
    id: int
    rating_avg: float | None = None
    rating_count: int = 0

    class Config:
        from_attributes = True


class InventoryItem(BaseModel):
    productId: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1)


class InventoryAdjustRequest(BaseModel):
    items: list[InventoryItem] = Field(..., min_length=1)


class ReviewCreate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=255)
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=1024)
    verified_purchase: bool = False


class ReviewOut(BaseModel):
    id: int
    product_id: int
    author_name: str
    rating: int
    comment: str | None = None
    verified_purchase: bool = False
    helpful_votes: int = 0
    has_voted: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


class ReviewUpdate(BaseModel):
    author_name: str = Field(..., min_length=1, max_length=255)
    rating: int = Field(..., ge=1, le=5)
    comment: str | None = Field(None, max_length=1024)


class ReviewMetaOut(BaseModel):
    totalCount: int

