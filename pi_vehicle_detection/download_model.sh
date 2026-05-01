#!/bin/bash

# This script downloads the pre-trained MobileNet SSD model files needed for the python script.

echo "Downloading MobileNet SSD architecture definition (prototxt)..."
wget -nc https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/voc/MobileNetSSD_deploy.prototxt

echo ""
echo "Downloading MobileNet SSD pre-trained weights (caffemodel)..."
wget -nc https://raw.githubusercontent.com/chuanqi305/MobileNet-SSD/master/voc/MobileNetSSD_deploy.caffemodel

echo ""
echo "Download complete! You can now run detect_vehicles.py"
