import cv2
import numpy as np
import time

# Paths to the MobileNet SSD model files
# You need to download these files (you can use the provided download_model.sh script)
prototxt = "MobileNetSSD_deploy.prototxt"
model = "MobileNetSSD_deploy.caffemodel"

# Classes that MobileNet SSD was trained to detect
CLASSES = ["background", "aeroplane", "bicycle", "bird", "boat",
           "bottle", "bus", "car", "cat", "chair", "cow", "diningtable",
           "dog", "horse", "motorbike", "person", "pottedplant", "sheep",
           "sofa", "train", "tvmonitor"]

# Vehicles we are interested in
VEHICLE_CLASSES = ["car", "bus", "motorbike"]

# Generate random colors for each class for bounding boxes
COLORS = np.random.uniform(0, 255, size=(len(CLASSES), 3))

print("[INFO] Loading model...")
try:
    net = cv2.dnn.readNetFromCaffe(prototxt, model)
except Exception as e:
    print(f"[ERROR] Failed to load model. Did you download the model files? Error: {e}")
    exit(1)

# Initialize the video stream. 
# '0' is usually the built-in or USB camera. If you are using the Pi Camera Module, 
# you might need to use 'picamera' library or set up V4L2 drivers to access it via /dev/video0.
print("[INFO] Starting video stream...")
cap = cv2.VideoCapture(0)

# Allow camera to warmup
time.sleep(2.0)

# FPS tracking variables
fps_start_time = time.time()
fps_frame_count = 0

try:
    while True:
        ret, frame = cap.read()
        if not ret:
            print("[ERROR] Failed to grab frame from camera.")
            break
            
        # Resize frame to improve performance on the Raspberry Pi
        height, width = frame.shape[:2]
        new_width = 400
        ratio = new_width / float(width)
        new_height = int(height * ratio)
        frame = cv2.resize(frame, (new_width, new_height))
        
        # Prepare the frame for the Deep Neural Network
        # MobileNet expects 300x300 input images
        blob = cv2.dnn.blobFromImage(cv2.resize(frame, (300, 300)), 0.007843,
                                     (300, 300), 127.5)
                                     
        # Pass the blob through the network to get detections
        net.setInput(blob)
        detections = net.forward()
        
        # Loop over the detections
        for i in np.arange(0, detections.shape[2]):
            # Extract the confidence (probability) associated with the prediction
            confidence = detections[0, 0, i, 2]
            
            # Filter out weak detections by ensuring confidence is greater than a minimum threshold
            if confidence > 0.5:
                # Extract the index of the class label from the detections
                idx = int(detections[0, 0, i, 1])
                
                # Check if the detected object is a vehicle
                if CLASSES[idx] in VEHICLE_CLASSES:
                    # Compute the (x, y)-coordinates of the bounding box
                    box = detections[0, 0, i, 3:7] * np.array([new_width, new_height, new_width, new_height])
                    (startX, startY, endX, endY) = box.astype("int")
                    
                    # Draw the bounding box and label on the frame
                    label = "{}: {:.2f}%".format(CLASSES[idx], confidence * 100)
                    cv2.rectangle(frame, (startX, startY), (endX, endY), COLORS[idx], 2)
                    
                    # Ensure label is visible if bounding box is at the top of the frame
                    y = startY - 15 if startY - 15 > 15 else startY + 15
                    cv2.putText(frame, label, (startX, y),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.5, COLORS[idx], 2)
                                
        # Calculate and display the FPS
        fps_frame_count += 1
        fps_elapsed = time.time() - fps_start_time
        fps = fps_frame_count / fps_elapsed
        cv2.putText(frame, "FPS: {:.2f}".format(fps), (10, 20),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 0), 2)
                    
        # Show the output frame
        cv2.imshow("Vehicle Detection", frame)
        
        # Wait for 'q' key to quit
        key = cv2.waitKey(1) & 0xFF
        if key == ord("q"):
            break

except KeyboardInterrupt:
    print("\n[INFO] Interrupted by user. Shutting down...")

finally:
    # Cleanup resources
    print("[INFO] Cleaning up...")
    cap.release()
    cv2.destroyAllWindows()
