# Raspberry Pi Vehicle Detection

This project contains a lightweight vehicle detection script designed to be runnable on a Raspberry Pi using a webcam or the Pi Camera Module. It uses OpenCV's Deep Neural Network (DNN) module with a pre-trained MobileNet Single Shot Detector (SSD) model, which offers a great balance between accuracy and performance on edge devices.

## Setup Instructions for Raspberry Pi

1. **Install dependencies:**
   You'll need OpenCV installed on your Pi. The easiest way to get it is using `pip`:
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: If `opencv-python` fails to install or takes too long, you might want to try `sudo apt-get install python3-opencv` instead, depending on your Pi's OS version).*

2. **Download the model files:**
   The Python script requires the pre-trained MobileNet SSD model files (`.prototxt` and `.caffemodel`). Run the provided bash script to download them:
   ```bash
   chmod +x download_model.sh
   ./download_model.sh
   ```

3. **Run the detection script:**
   Connect your USB webcam or Pi Camera (ensure it's enabled in `raspi-config`), and run:
   ```bash
   python3 detect_vehicles.py
   ```

## Controls
- Press **`q`** in the video window to quit the application.

## Troubleshooting
- **Cannot open camera:** If the script errors out when opening the camera, change `cv2.VideoCapture(0)` to `cv2.VideoCapture(1)` or similar if you have multiple cameras connected.
- **Slow performance:** MobileNet SSD is relatively fast, but you should expect around 3-10 FPS on a Raspberry Pi depending on the model (Pi 3 vs Pi 4). The frame is resized to width=400 to improve speed.
