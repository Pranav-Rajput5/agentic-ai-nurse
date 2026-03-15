import serial
import time
import requests
import sys

# --- HARDWARE CONFIG ---
BLUETOOTH_PORT = '/dev/cu.AI_Nurse_Watch' 
BAUD_RATE = 115200

# --- BACKEND CONFIG ---
API_URL = "http://localhost:8000"  

print("\n" + "="*40)
print(" AI NURSE WATCH - BLUETOOTH BRIDGE")
print("="*40)

# --- THE RUNTIME FIX ---
# Check if you passed the ID in the terminal command
if len(sys.argv) > 1:
    PATIENT_ID = sys.argv[1]
else:
    PATIENT_ID = input("Enter Patient ID for this demo (e.g., p_c03fa4): ").strip()

if not PATIENT_ID:
    print("Error: You must provide a Patient ID!")
    sys.exit(1)

print(f"\nTargeting Patient Database ID: {PATIENT_ID}")
print("-" * 40)

try:
    print(f"Connecting to AI Nurse Watch on {BLUETOOTH_PORT}...")
    ser = serial.Serial(BLUETOOTH_PORT, BAUD_RATE, timeout=0.1)
    ser.flushInput()
    print("Connection Active! Listening for vitals...\n")
    
    while True:
        line = ser.readline().decode('utf-8', errors='ignore').strip()
        
        if line:
            try:
                parts = line.split(',')
                if len(parts) == 2:
                    bpm = int(parts[0])
                    fall = int(parts[1])
                    
                    if fall == 1:
                        print(f"ALERT: FALL DETECTED! | BPM: {bpm}")
                    else:
                        print(f"BPM: {bpm} | Status: Normal")
                    
                    payload = {
                        "bpm": bpm,
                        "fall_detected": fall
                    }
                    
                    try:
                        # Send the data to main.py instantly using the dynamic PATIENT_ID
                        requests.post(
                            f"{API_URL}/device/vitals/{PATIENT_ID}", 
                            json=payload, 
                            timeout=0.5
                        )
                    except requests.exceptions.RequestException as e:
                        print(f"⚠️ Backend offline: {e}")
            
            except ValueError:
                continue 

except Exception as e:
    print(f"Error: {e}")
finally:
    if 'ser' in locals():
        ser.close()