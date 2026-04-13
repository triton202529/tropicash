from fastapi import FastAPI, HTTPException
from models import *
from supabase_client import supabase
import os

app = FastAPI()

API_KEY = os.getenv("API_SECRET_KEY")

def verify_key(key: str):
    if key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API Key")

@app.post("/get-balance")
def get_balance(req: AuthRequest):
    try:
        verify_key(req.api_key)
        print("✅ API key verified:", req.api_key)

        response = supabase.table("wallets").select("wallet_balance", "triton_balance").eq("user_id", req.user_id).single().execute()
        data = response.data
        print("📦 Supabase response:", data)

        if not data:
            raise HTTPException(status_code=404, detail="Wallet not found")

        return data

    except Exception as e:
        print("🔥 Exception in /get-balance:", str(e))
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.post("/execute-trade")
def execute_trade(req: TradeExecutionRequest):
    try:
        verify_key(req.api_key)
        print("✅ API key verified:", req.api_key)

        response = supabase.table("wallets").select("*").eq("user_id", req.user_id).single().execute()
        wallet = response.data

        if not wallet:
            print("❌ Wallet not found")
            raise HTTPException(status_code=404, detail="Wallet not found")

        balance = wallet["triton_balance"]
        if req.amount > balance:
            print("❌ Insufficient Triton balance")
            raise HTTPException(status_code=400, detail="Insufficient Triton balance")

        new_balance = balance - req.amount
        supabase.table("wallets").update({"triton_balance": new_balance}).eq("user_id", req.user_id).execute()
        supabase.table("transactions").insert({
            "user_id": req.user_id,
            "amount": req.amount,
            "type": "trade_execution",
            "metadata": { "ticker": req.ticker }
        }).execute()

        print("✅ Trade executed")
        return { "success": True, "new_triton_balance": new_balance }

    except Exception as e:
        print("🔥 Exception in /execute-trade:", str(e))
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")

@app.post("/withdraw-from-triton")
def withdraw(req: WithdrawRequest):
    try:
        verify_key(req.api_key)
        print("✅ API key verified:", req.api_key)

        response = supabase.table("wallets").select("*").eq("user_id", req.user_id).single().execute()
        wallet = response.data

        if not wallet:
            print("❌ Wallet not found")
            raise HTTPException(status_code=404, detail="Wallet not found")

        triton_balance = wallet["triton_balance"]
        if req.amount > triton_balance:
            print("❌ Insufficient Triton balance")
            raise HTTPException(status_code=400, detail="Insufficient Triton balance")

        new_wallet_balance = wallet["wallet_balance"] + req.amount
        new_triton_balance = triton_balance - req.amount

        supabase.table("wallets").update({
            "wallet_balance": new_wallet_balance,
            "triton_balance": new_triton_balance
        }).eq("user_id", req.user_id).execute()

        supabase.table("transactions").insert({
            "user_id": req.user_id,
            "amount": req.amount,
            "type": "withdraw_triton"
        }).execute()

        print("✅ Withdrawal complete")
        return { "success": True, "wallet_balance": new_wallet_balance }

    except Exception as e:
        print("🔥 Exception in /withdraw-from-triton:", str(e))
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")
