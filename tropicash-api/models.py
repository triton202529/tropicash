from pydantic import BaseModel

class AuthRequest(BaseModel):
    user_id: str
    api_key: str

class TradeExecutionRequest(AuthRequest):
    amount: float
    ticker: str

class WithdrawRequest(AuthRequest):
    amount: float

