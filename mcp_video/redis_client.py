"""
Redis client for caching video generation results
"""

import redis.asyncio as redis
import json
import hashlib
import logging
from typing import Optional, Dict, Any
try:
    from .config import settings
except ImportError:
    from config import settings

logger = logging.getLogger(__name__)

class RedisClient:
    """Redis client for video caching and session management"""
    
    def __init__(self, redis_url: str = None):
        self.redis_url = redis_url or settings.redis_url
        self.redis = None
        
    async def connect(self):
        """Connect to Redis"""
        try:
            self.redis = redis.from_url(self.redis_url, decode_responses=True)
            await self.redis.ping()
            logger.info("Connected to Redis successfully")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {str(e)}")
            raise
    
    async def disconnect(self):
        """Disconnect from Redis"""
        if self.redis:
            await self.redis.close()
    
    def _generate_cache_key(self, user_id: str, image_url: str, action: str, duration: int) -> str:
        """Generate cache key for video"""
        content = f"{user_id}:{image_url}:{action}:{duration}"
        return f"video:{hashlib.md5(content.encode()).hexdigest()}"
    
    async def get_cached_video(
        self, 
        user_id: str, 
        image_url: str, 
        action: str, 
        duration: int
    ) -> Optional[Dict[str, Any]]:
        """Get cached video result"""
        try:
            if not self.redis:
                await self.connect()
                
            cache_key = self._generate_cache_key(user_id, image_url, action, duration)
            cached_data = await self.redis.get(cache_key)
            
            if cached_data:
                logger.info(f"Cache hit for video: {cache_key}")
                return json.loads(cached_data)
            
            logger.info(f"Cache miss for video: {cache_key}")
            return None
            
        except Exception as e:
            logger.error(f"Error getting cached video: {str(e)}")
            return None
    
    async def cache_video(
        self,
        user_id: str,
        image_url: str,
        action: str,
        duration: int,
        video_data: Dict[str, Any],
        ttl: int = None
    ):
        """Cache video result"""
        try:
            if not self.redis:
                await self.connect()
                
            cache_key = self._generate_cache_key(user_id, image_url, action, duration)
            ttl = ttl or settings.video_cache_ttl
            
            await self.redis.setex(
                cache_key,
                ttl,
                json.dumps(video_data)
            )
            
            logger.info(f"Cached video: {cache_key} (TTL: {ttl}s)")
            
        except Exception as e:
            logger.error(f"Error caching video: {str(e)}")
    
    async def store_user_session(self, user_id: str, session_data: Dict[str, Any]):
        """Store user session data"""
        try:
            if not self.redis:
                await self.connect()
                
            session_key = f"sess:{user_id}"
            await self.redis.setex(
                session_key,
                3600,  # 1 hour TTL
                json.dumps(session_data)
            )
            
            logger.info(f"Stored session for user: {user_id}")
            
        except Exception as e:
            logger.error(f"Error storing session: {str(e)}")
    
    async def get_user_session(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user session data"""
        try:
            if not self.redis:
                await self.connect()
                
            session_key = f"sess:{user_id}"
            session_data = await self.redis.get(session_key)
            
            if session_data:
                return json.loads(session_data)
            
            return None
            
        except Exception as e:
            logger.error(f"Error getting session: {str(e)}")
            return None
    
    async def add_to_user_history(self, user_id: str, video_data: Dict[str, Any]):
        """Add video to user history"""
        try:
            if not self.redis:
                await self.connect()
                
            history_key = f"hist:{user_id}"
            
            # Add to list (most recent first)
            await self.redis.lpush(history_key, json.dumps(video_data))
            
            # Keep only last 20 items
            await self.redis.ltrim(history_key, 0, 19)
            
            # Set expiry
            await self.redis.expire(history_key, 86400 * 7)  # 7 days
            
            logger.info(f"Added video to history for user: {user_id}")
            
        except Exception as e:
            logger.error(f"Error adding to history: {str(e)}")
    
    async def get_user_history(self, user_id: str, limit: int = 10) -> list:
        """Get user video history"""
        try:
            if not self.redis:
                await self.connect()
                
            history_key = f"hist:{user_id}"
            history_data = await self.redis.lrange(history_key, 0, limit - 1)
            
            return [json.loads(item) for item in history_data]
            
        except Exception as e:
            logger.error(f"Error getting history: {str(e)}")
            return []
    
    async def store_last_video(self, user_id: str, video_url: str):
        """Store user's last generated video URL"""
        try:
            if not self.redis:
                await self.connect()
                
            last_video_key = f"last_video:{user_id}"
            await self.redis.setex(last_video_key, 3600, video_url)  # 1 hour TTL
            
            logger.info(f"Stored last video for user: {user_id}")
            
        except Exception as e:
            logger.error(f"Error storing last video: {str(e)}")
    
    async def get_last_video(self, user_id: str) -> Optional[str]:
        """Get user's last generated video URL"""
        try:
            if not self.redis:
                await self.connect()
                
            last_video_key = f"last_video:{user_id}"
            return await self.redis.get(last_video_key)
            
        except Exception as e:
            logger.error(f"Error getting last video: {str(e)}")
            return None

# Global Redis client instance
redis_client = RedisClient()
