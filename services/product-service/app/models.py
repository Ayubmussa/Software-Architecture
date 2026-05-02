from sqlalchemy import Column, Integer, String, Numeric, ForeignKey, DateTime, func, UniqueConstraint
from sqlalchemy.orm import relationship

from .database import Base


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1024), nullable=True)
    category = Column(String(255), nullable=True, index=True)
    price = Column(Numeric(10, 2), nullable=False)
    stock = Column(Integer, nullable=False, default=0)
    image_url = Column(String(512), nullable=True)
    reviews = relationship("ProductReview", back_populates="product", cascade="all, delete-orphan")


class ProductReview(Base):
    __tablename__ = "product_reviews"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    author_name = Column(String(255), nullable=False)
    rating = Column(Integer, nullable=False)
    comment = Column(String(1024), nullable=True)
    verified_purchase = Column(Integer, nullable=False, default=0)
    helpful_votes = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    product = relationship("Product", back_populates="reviews")


class ReviewHelpfulVote(Base):
    __tablename__ = "review_helpful_votes"
    __table_args__ = (UniqueConstraint("review_id", "voter_key", name="uq_review_voter"),)

    id = Column(Integer, primary_key=True, index=True)
    review_id = Column(Integer, ForeignKey("product_reviews.id", ondelete="CASCADE"), nullable=False, index=True)
    voter_key = Column(String(255), nullable=False, index=True)

