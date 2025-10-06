import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    app_name: str = "E-commerce API"
    app_version: str = "1.0.0"

    # PostgreSQL
    postgres_host: str
    postgres_port: int
    postgres_user: str
    postgres_password: str
    postgres_db: str

    # Redis
    redis_host: str
    redis_port: int

    # App
    secret_key: str
    debug: bool = False

    @property
    def database_url(self) -> str:
        return f"postgresql://{self.postgres_user}:{self.postgres_password}@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
