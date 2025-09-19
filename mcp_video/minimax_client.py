"""
MiniMax API Client for video generation
"""

import httpx
import asyncio
import logging
from typing import Dict, Any, Optional, Literal
import json
import time
try:
    from .config import settings
except ImportError:
    from config import settings

logger = logging.getLogger(__name__)

class MiniMaxClient:
    """Client for MiniMax video generation API"""
    
    def __init__(self, api_key: str = None, base_url: str = None):
        self.api_key = api_key or settings.minimax_api_key
        self.base_url = base_url or settings.minimax_base_url
        self.client = httpx.AsyncClient(timeout=120.0)  # 2 minute timeout for video generation
        
    async def __aenter__(self):
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.client.aclose()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for API requests"""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
    
    async def generate_video(
        self,
        image_url: str,
        action: Literal["turn", "wave", "walk"],
        duration: int = 4,
        aspect_ratio: str = "9:16"
    ) -> Dict[str, Any]:
        """
        Generate a video from an image with specified action
        
        Args:
            image_url: URL of the input image
            action: Type of action to perform
            duration: Duration in seconds (3-6)
            aspect_ratio: Video aspect ratio (default 9:16)
            
        Returns:
            Dict containing video generation result
        """
        try:
            # Map actions to MiniMax prompts
            action_prompts = {
                "turn": "The person slowly turns around to show the outfit from different angles, smooth rotation movement",
                "wave": "The person waves their hand in a friendly greeting gesture while wearing the outfit",
                "walk": "The person takes a few steps forward in a natural walking motion, showing the outfit in movement"
            }
            
            prompt = action_prompts.get(action, action_prompts["turn"])
            
            payload = {
                "model": "video-01",  # MiniMax video model
                "prompt": prompt,
                "image": image_url,
                "duration": duration,
                "aspect_ratio": aspect_ratio,
                "quality": "high",
                "fps": 24
            }
            
            logger.info(f"Generating video with MiniMax: action={action}, duration={duration}s")
            
            response = await self.client.post(
                f"{self.base_url}/video/generations",
                headers=self._get_headers(),
                json=payload
            )
            
            if response.status_code != 200:
                error_msg = f"MiniMax API error: {response.status_code} - {response.text}"
                logger.error(error_msg)
                raise Exception(error_msg)
            
            result = response.json()
            
            # Check if we need to poll for completion
            if result.get("status") == "processing":
                task_id = result.get("id")
                result = await self._poll_for_completion(task_id)
            
            return result
            
        except Exception as e:
            logger.error(f"Video generation failed: {str(e)}")
            raise
    
    async def _poll_for_completion(self, task_id: str, max_wait: int = 300) -> Dict[str, Any]:
        """
        Poll for video generation completion
        
        Args:
            task_id: Task ID to poll
            max_wait: Maximum wait time in seconds
            
        Returns:
            Completed video generation result
        """
        start_time = time.time()
        
        while time.time() - start_time < max_wait:
            try:
                response = await self.client.get(
                    f"{self.base_url}/video/generations/{task_id}",
                    headers=self._get_headers()
                )
                
                if response.status_code != 200:
                    logger.error(f"Polling error: {response.status_code} - {response.text}")
                    await asyncio.sleep(5)
                    continue
                
                result = response.json()
                status = result.get("status")
                
                if status == "completed":
                    logger.info(f"Video generation completed for task {task_id}")
                    return result
                elif status == "failed":
                    error_msg = result.get("error", "Unknown error")
                    raise Exception(f"Video generation failed: {error_msg}")
                
                # Still processing, wait and retry
                await asyncio.sleep(5)
                
            except Exception as e:
                logger.error(f"Polling error: {str(e)}")
                await asyncio.sleep(5)
        
        raise Exception(f"Video generation timed out after {max_wait} seconds")
    
    async def create_storyboard(
        self,
        image_url: str,
        product_attrs: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Create a storyboard for video animation
        
        Args:
            image_url: URL of the input image
            product_attrs: Product attributes for context
            
        Returns:
            Storyboard with beats and copy
        """
        try:
            # Generate intelligent storyboard based on product attributes
            product_type = product_attrs.get("type", "clothing")
            color = product_attrs.get("color", "")
            style = product_attrs.get("style", "")
            
            # Default storyboard logic
            beats = ["turn"]  # Start with basic turn
            
            # Add actions based on product type
            if product_type in ["hoodie", "jacket", "coat"]:
                beats.extend(["wave", "close_up"])
            elif product_type in ["dress", "skirt"]:
                beats.extend(["walk", "turn"])
            else:
                beats.extend(["wave"])
            
            # Generate copy
            copy_templates = [
                f"Show off your new {product_type} with confidence!",
                f"Perfect fit in {color} - see how it moves with you!",
                f"Style meets comfort in this {style} {product_type}!"
            ]
            
            copy = copy_templates[0]
            if color:
                copy = copy_templates[1]
            elif style:
                copy = copy_templates[2]
            
            return {
                "beats": beats,
                "copy": copy,
                "duration_estimate": len(beats) * 2  # 2 seconds per beat
            }
            
        except Exception as e:
            logger.error(f"Storyboard creation failed: {str(e)}")
            # Return default storyboard
            return {
                "beats": ["turn", "wave"],
                "copy": "Show off your new look!",
                "duration_estimate": 4
            }
    
    async def compose_multi_action_video(
        self,
        image_url: str,
        actions: list,
        aspect_ratio: str = "9:16"
    ) -> Dict[str, Any]:
        """
        Compose a video with multiple actions
        
        Args:
            image_url: URL of the input image
            actions: List of actions to perform
            aspect_ratio: Video aspect ratio
            
        Returns:
            Composed video result
        """
        try:
            # For now, we'll generate individual videos and return the first one
            # In a full implementation, we'd stitch them together
            if not actions:
                actions = ["turn"]
            
            # Generate video for the first action
            primary_action = actions[0]
            duration = min(len(actions) * 2, 6)  # 2 seconds per action, max 6 seconds
            
            result = await self.generate_video(
                image_url=image_url,
                action=primary_action,
                duration=duration,
                aspect_ratio=aspect_ratio
            )
            
            # Add metadata about all actions
            result["composed_actions"] = actions
            result["action_sequence"] = actions
            
            return result
            
        except Exception as e:
            logger.error(f"Multi-action video composition failed: {str(e)}")
            raise
