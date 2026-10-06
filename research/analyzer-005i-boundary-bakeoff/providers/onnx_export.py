"""ONNX export feasibility — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B).

python -I onnx_export.py --deeplsd-repo <DeepLSD> --deeplsd-ckpt deeplsd_md.tar --msam-repo <MobileSAM> \
    --msam-ckpt mobile_sam.pt --out <dir outside the repo>

Exports, for the deployment estimate only (nothing here is shipped):
  * DeepLSD's network (VGG-UNet + distance-field and angle heads) with dynamic H x W. The LSD step that turns the
    fields into segments (pytlsd, AGPL C code) is NOT part of the graph and cannot be exported;
  * MobileSAM's image encoder (1x3x1024x1024) and its prompt-encoder + mask-decoder (upstream SamOnnxModel, the
    graph upstream scripts/export_onnx_model.py exports).
Then checks each ONNX graph against PyTorch on one input with onnx's checker (numerical parity is measured by
wasm_probe.mjs against these PyTorch outputs, saved as .npy).
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import common  # noqa: E402


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--deeplsd-repo", required=True)
    p.add_argument("--deeplsd-ckpt", required=True)
    p.add_argument("--msam-repo", required=True)
    p.add_argument("--msam-ckpt", required=True)
    p.add_argument("--gray", required=True, help="a frame's production luma (gray PNG) for the parity input")
    p.add_argument("--rgb", required=True)
    p.add_argument("--out", required=True)
    a = p.parse_args()
    sys.path.insert(0, a.deeplsd_repo)
    sys.path.insert(0, a.msam_repo)
    import numpy as np
    import torch
    import onnx
    from torch import nn
    os.makedirs(a.out, exist_ok=True)
    torch.set_num_threads(1)
    report = {}

    # --- DeepLSD network -----------------------------------------------------------------------------------------
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from deeplsd_run import load_ckpt
    from deeplsd.models.deeplsd_inference import DeepLSD

    class Fields(nn.Module):
        def __init__(self, net):
            super().__init__()
            self.net = net

        def forward(self, image):
            base = self.net.backbone(image)
            df = self.net.denormalize_df(self.net.df_head(base).squeeze(1))
            ll = self.net.angle_head(base).squeeze(1) * np.pi
            return df, ll

    net = DeepLSD({"detect_lines": False})
    net.load_state_dict(load_ckpt(a.deeplsd_ckpt)["model"], strict=True)
    net.eval()
    f = Fields(net).eval()
    img = common.read_gray(a.gray).astype(np.float32) / 255.0
    x = torch.tensor(img)[None, None]
    t0 = time.perf_counter()
    with torch.no_grad():
        df, ll = f(x)
    report["deeplsdTorchMs1Thread"] = common.r3((time.perf_counter() - t0) * 1000)
    path = os.path.join(a.out, "deeplsd_md_fields.onnx")
    torch.onnx.export(f, x, path, input_names=["image"], output_names=["df", "line_level"], dynamic_axes={"image": {2: "h", 3: "w"}, "df": {1: "h", 2: "w"}, "line_level": {1: "h", 2: "w"}}, opset_version=17)
    onnx.checker.check_model(onnx.load(path))
    np.save(os.path.join(a.out, "deeplsd_input.npy"), img)
    np.save(os.path.join(a.out, "deeplsd_df_torch.npy"), df.numpy()[0])
    report["deeplsdOnnx"] = {"file": path, "bytes": os.path.getsize(path), "sha256": common.sha256_file(path), "inputShape": list(x.shape)}

    # --- MobileSAM encoder and decoder ------------------------------------------------------------------------------
    from mobile_sam import sam_model_registry
    from mobile_sam.utils.onnx import SamOnnxModel
    from mobile_sam.utils.transforms import ResizeLongestSide
    sam = sam_model_registry["vit_t"](checkpoint=None)
    sam.load_state_dict(torch.load(a.msam_ckpt, map_location="cpu", weights_only=True), strict=True)
    sam.eval()
    rgb = common.read_rgb(a.rgb)
    tr = ResizeLongestSide(1024)
    im = tr.apply_image(rgb)
    t = torch.as_tensor(im).permute(2, 0, 1).contiguous()[None].float()
    t = sam.preprocess(t)
    t0 = time.perf_counter()
    with torch.no_grad():
        emb = sam.image_encoder(t)
    report["msamEncoderTorchMs1Thread"] = common.r3((time.perf_counter() - t0) * 1000)
    enc_path = os.path.join(a.out, "mobile_sam_encoder.onnx")
    torch.onnx.export(sam.image_encoder, t, enc_path, input_names=["image"], output_names=["embedding"], opset_version=17)
    onnx.checker.check_model(onnx.load(enc_path))
    np.save(os.path.join(a.out, "msam_input.npy"), t.numpy()[0])
    np.save(os.path.join(a.out, "msam_embedding_torch.npy"), emb.numpy()[0])
    report["msamEncoderOnnx"] = {"file": enc_path, "bytes": os.path.getsize(enc_path), "sha256": common.sha256_file(enc_path)}
    dec = SamOnnxModel(sam, return_single_mask=True)
    dummy = {
        "image_embeddings": torch.randn(1, 256, 64, 64, dtype=torch.float),
        "point_coords": torch.randint(low=0, high=1024, size=(1, 5, 2), dtype=torch.float),
        "point_labels": torch.randint(low=0, high=4, size=(1, 5), dtype=torch.float),
        "mask_input": torch.randn(1, 1, 256, 256, dtype=torch.float),
        "has_mask_input": torch.tensor([1], dtype=torch.float),
        "orig_im_size": torch.tensor([1500, 2250], dtype=torch.float),
    }
    dec_path = os.path.join(a.out, "mobile_sam_decoder.onnx")
    torch.onnx.export(dec, tuple(dummy.values()), dec_path, input_names=list(dummy.keys()), output_names=["masks", "iou_predictions", "low_res_masks"], dynamic_axes={"point_coords": {1: "num_points"}, "point_labels": {1: "num_points"}}, opset_version=17)
    onnx.checker.check_model(onnx.load(dec_path))
    report["msamDecoderOnnx"] = {"file": dec_path, "bytes": os.path.getsize(dec_path), "sha256": common.sha256_file(dec_path)}
    with open(os.path.join(a.out, "export.json"), "w") as fo:
        json.dump(report, fo, indent=1, sort_keys=True)
    print(json.dumps(report, indent=1))


if __name__ == "__main__":
    main()
