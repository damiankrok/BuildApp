"""IU-01 approach B: a frozen pretrained backbone + a multinomial logistic-regression head trained on TRAIN only.

Hyper-parameter C and the softmax temperature are chosen on VAL; nothing reads TEST. With 17 training projects a
linear head is what the data can honestly support — fine-tuning the backbone is not attempted (see report).
Training rows include white- and grey-letterboxed copies of every image, so the pad colour carries no label.
"""
import numpy as np
from sklearn.linear_model import LogisticRegression
from .classes import CLASSES

def fit(X, y, C):
    m = LogisticRegression(C=C, max_iter=4000, class_weight='balanced')
    m.fit(X, y)
    return m

def logits(m, X):
    # decision_function columns follow m.classes_; re-order into CLASSES (absent classes get -inf)
    z = m.decision_function(X)
    out = np.full((X.shape[0], len(CLASSES)), -1e9, dtype=np.float64)
    for j, c in enumerate(m.classes_):
        out[:, CLASSES.index(c)] = z[:, j]
    return out

def softmax(z, T=1.0):
    z = z / T
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)

def nll(p, y_idx):
    return float(-np.mean(np.log(np.clip(p[np.arange(len(y_idx)), y_idx], 1e-12, 1))))

def fit_temperature(z, y_idx):
    grid = np.exp(np.linspace(np.log(0.05), np.log(20), 200))
    best = min(grid, key=lambda T: nll(softmax(z, T), y_idx))
    return float(best)

def ece(p, y_idx, bins=10):
    conf = p.max(1); pred = p.argmax(1); ok = pred == y_idx
    e = 0.0
    for lo in np.linspace(0, 1, bins, endpoint=False):
        s = (conf > lo) & (conf <= lo + 1 / bins)
        if s.any():
            e += s.mean() * abs(ok[s].mean() - conf[s].mean())
    return float(e)
