# 🥭 Mango Grade

A multimodal mango quality grading system that combines image features and gas sensor data using a Bayesian Neural Network.

The system is designed to classify **Arumanis mangoes** into three quality grades:

- Grade A
- Grade B
- Grade C

The model combines visual characteristics extracted from mango images with gas sensor measurements to produce a classification result along with an uncertainty estimate.

---

## 📌 Overview

Conventional mango grading can depend heavily on visual inspection and human experience, which may lead to subjective and inconsistent results.

This project explores a multimodal approach by combining:

- Image-based features
- Gas sensor measurements
- Deep learning-based feature extraction
- Dimensionality reduction
- Bayesian Neural Network classification

The system integrates an **ESP32 + MQ-135 gas sensor**, image processing, a machine learning pipeline, and a web-based interface.

---

## 🧠 System Architecture

The overall pipeline can be summarized as:

```text
                 ┌─────────────────────┐
                 │    Mango Image      │
                 └──────────┬──────────┘
                            │
                ┌───────────┴───────────┐
                │                       │
                ▼                       ▼
          Image Processing         MobileNetV2
                │                 Feature Extraction
                │                       │
                ▼                       ▼
          Area / Hue Median        Visual Features
                │                       │
                └───────────┬───────────┘
                            │
                            ▼
                           PCA
                            │
                            ▼
                   Reduced Visual Features
                            │
                            │
MQ-135 ──► ESP32 ──► Delta Gas
                            │
                            ▼
              ┌─────────────────────────┐
              │ Feature Fusion           │
              │                         │
              │ • Area                  │
              │ • Hue Median            │
              │ • Delta Gas             │
              │ • MobileNetV2 + PCA     │
              └────────────┬────────────┘
                           │
                           ▼
                 Bayesian Neural Network
                           │
                  ┌────────┴─────────┐
                  ▼                  ▼
              Mango Grade        Uncertainty
             A / B / C
