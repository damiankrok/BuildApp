# 005G — sources

Checked 2026-10-05.

**Downloaded and hashed in this session (outside the worktree, never committed):**
- the six PaddleOCR ONNX models;
- Node 18.20.4;
- the npm and PyPI packages;
- the ONNX Runtime 1.30.0 / 1.28.0 AARs;
- the ML Kit AARs;
- the OpenCV 4.14.0 AAR;
- PDFBox 3.0.8.

**Not reachable here:** github.com HTML returned 403 from this session's proxy, so licences and READMEs were read
from `raw.githubusercontent.com`, the registries or blobless clones. Maven Central rate-limited two requests (the
`.sha1` sidecars and the PdfBox-Android AAR); the AAR SHA-256s below were computed locally instead.

## BuildApp evidence (in the repository)

- `stage-reports/artifacts/analyzer-005e/calibration/development-labels.json`: 81 transcribed labels.
- `stage-reports/artifacts/analyzer-005e/calibration/README.md`, `analyzer-005f/calibration/README.md`: reader
  calibration records.
- `stage-reports/artifacts/analyzer-005c/aster-viii/source-package.json`,
  `analyzer-005c/holdout/h2-galaktyka/source-package.json`: the recorded outline PDFs and their SHA-256.
- `stage-reports/artifacts/analyzer-005{d,e,f}/evidence/*/14-selected-layout.json`: layout regions (geometry probe).
- Canonical models: `stage-reports/artifacts/analyzer-v2/marcowki-model.json`, `stage-reports/artifacts/building-model.json`, `integration-004a/kosacce/model.json`, `analyzer-005c/holdout/h1-dom-w-azaliach/model.json`, `analyzer-005d/holdout/h2-dom-w-tunbergiach/model.json`, `analyzer-005e/holdout/h2-dom-w-morelach/model.json`, `analyzer-005f/holdout/h2-dom-w-helikoniach/model.json`.
- Sealed blind-run packages and byte caches outside the worktree (left by 005D–005F):
  - `/home/user/work005d/{cache,blind-cache,m4}`
  - `/home/user/work005e/{base,blind5}`
  - `/home/user/work005f/blind6`

## Models

| model | URL | file SHA-256 |
| --- | --- | --- |
| PP-OCRv6 tiny rec ONNX | https://huggingface.co/PaddlePaddle/PP-OCRv6_tiny_rec_onnx (API: https://huggingface.co/api/models/PaddlePaddle/PP-OCRv6_tiny_rec_onnx) | `9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6` |
| PP-OCRv6 small rec ONNX | https://huggingface.co/PaddlePaddle/PP-OCRv6_small_rec_onnx | `5435fd747c9e0efe15a96d0b378d5bd157e9492ed8fd80edf08f30d02fa24634` |
| PP-OCRv6 medium rec ONNX | https://huggingface.co/PaddlePaddle/PP-OCRv6_medium_rec_onnx | `9c09abf0957f7968c7586464b7397b84ad2387a0497a351af40e9acc71b673ba` |
| en PP-OCRv5 mobile rec ONNX | https://huggingface.co/PaddlePaddle/en_PP-OCRv5_mobile_rec_onnx | `b5f833dfc5d0eb71da397b4efa06ebeee9b431b690a47d6af40d77d8eabc557f` |
| latin PP-OCRv5 mobile rec ONNX | https://huggingface.co/PaddlePaddle/latin_PP-OCRv5_mobile_rec_onnx | `7888113072263cb471b93f66dd5e2ad70548dc526fa1ace760d0d973dd121498` |
| PP-OCRv5 mobile rec ONNX | https://huggingface.co/PaddlePaddle/PP-OCRv5_mobile_rec_onnx | `da72dc72ca4dc220df0dfde68c1dedc31c58d3e76a25871122e5056227d50092` |

PaddleOCR reports:
- https://arxiv.org/html/2507.05595v1 (3.0)
- https://www.alphaxiv.org/abs/2603.24373.md (PP-OCRv5)
- https://arxiv.org/abs/2606.13108 (PP-OCRv6)

PaddleOCR licence: https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/main/LICENSE

## Packages and runtimes

- ONNX Runtime:
  - https://registry.npmjs.org/onnxruntime-web, https://registry.npmjs.org/onnxruntime-node (1.30.0 tarballs)
  - https://raw.githubusercontent.com/microsoft/onnxruntime/v1.30.0/docs/Privacy.md (and v1.28.0)
  - https://repo1.maven.org/maven2/com/microsoft/onnxruntime/onnxruntime-android/1.30.0/ (AAR SHA-256 `e7fb945e…73f1`)
  - …/1.28.0/ (AAR SHA-256 `f351a063…a8b9`)
  - https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- Node 18.20.4: https://nodejs.org/dist/v18.20.4/node-v18.20.4-linux-x64.tar.xz (SHA-256 `592eb35c…5063`, matches `SHASUMS256.txt`).
- RapidOCR:
  - https://pypi.org/pypi/rapidocr/json (3.9.2)
  - https://raw.githubusercontent.com/RapidAI/RapidOCR/main/README.md
  - https://www.modelscope.cn/api/v1/models/RapidAI/RapidOCR
- Tesseract:
  - https://registry.npmjs.org/tesseract.js (7.0.0)
  - https://registry.npmjs.org/@tesseract.js-data/eng
  - https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/main/README.md
  - https://raw.githubusercontent.com/tesseract-ocr/tessdoc/main/ReleaseNotes.md
  - NVD CVE-2026-73066, CVE-2026-88047…88054
- ML Kit:
  - https://developers.google.com/ml-kit/vision/text-recognition/v2/android
  - https://developers.google.com/ml-kit/terms
  - https://developers.google.com/ml-kit/android-data-disclosure
  - https://dl.google.com/android/maven2/com/google/mlkit/text-recognition/16.0.1/
  - …/text-recognition-bundled-common/17.0.0/
- PDF.js:
  - https://registry.npmjs.org/pdfjs-dist (4.8.69 tested; engines per version read from the registry)
  - https://nvd.nist.gov/vuln/detail/CVE-2024-4367
  - https://osv.dev/vulnerability/GHSA-hq66-cqwq-w95j (CVE-2026-16633)
- PDFBox:
  - https://repo1.maven.org/maven2/org/apache/pdfbox/pdfbox-app/3.0.8/ (jar SHA-256 `f6b3a80c…ceb1`)
  - https://pdfbox.apache.org/
  - https://repo1.maven.org/maven2/com/tom-roush/pdfbox-android/maven-metadata.xml
- PDFium:
  - https://pdfium.googlesource.com/pdfium/+/refs/heads/main/LICENSE
  - https://raw.githubusercontent.com/bblanchon/pdfium-binaries/master/README.md
  - https://registry.npmjs.org/@hyzyla/pdfium
- DWG/DXF:
  - https://registry.npmjs.org/dxf-parser (1.1.2, MIT)
  - https://pypi.org/pypi/ezdxf/json (1.4.4, MIT)
  - https://registry.npmjs.org/@mlightcad/libredwg-web (0.7.14, GPL-3.0)
- OpenCV:
  - https://repo1.maven.org/maven2/org/opencv/opencv/4.14.0/ (AAR SHA-256 `6d11b40f…494d`)
  - https://registry.npmjs.org/@techstark/opencv-js
  - https://raw.githubusercontent.com/opencv/opencv/4.5.0/LICENSE
  - https://nvd.nist.gov/vuln/detail/CVE-2025-53644
- Geometry:
  - https://registry.npmjs.org/polygon-clipping, https://registry.npmjs.org/polyclip-ts, https://registry.npmjs.org/clipper2-js, https://registry.npmjs.org/clipper2-ts, https://registry.npmjs.org/jsts
  - https://raw.githubusercontent.com/AngusJohnson/Clipper2/main/LICENSE
  - https://www.angusj.com/clipper2/Docs/Overview.htm
  - https://raw.githubusercontent.com/locationtech/jts/master/LICENSES.md
  - polygon-clipping issues #95, #149, #153, #157, #173 and polyclip-ts issues #21, #22, #27 (read through the GitHub search API)
- 3D:
  - https://registry.npmjs.org/manifold-3d
  - https://raw.githubusercontent.com/CGAL/cgal/master/Installation/LICENSE
  - https://raw.githubusercontent.com/Open-Cascade-SAS/OCCT/master/OCCT_LGPL_EXCEPTION.txt

## Floor-plan ML

- RoomFormer:
  - https://raw.githubusercontent.com/ywyue/RoomFormer/main/LICENSE
  - https://structured3d-dataset.org/
  - https://huggingface.co/datasets/Pointcept/structured3d-compressed
  - https://kaldir.vc.in.tum.de/scannet/ScanNet_TOS.pdf
- DeepFloorplan: https://raw.githubusercontent.com/zlzeng/DeepFloorplan/master/LICENSE, …/pretrained/download_links.txt
- TF2DeepFloorplan: https://raw.githubusercontent.com/zcemycl/TF2DeepFloorplan/main/LICENSE
- CubiCasa5K: https://raw.githubusercontent.com/CubiCasa/CubiCasa5k/master/LICENSE, https://zenodo.org/record/2613548
- Raster-to-Vector: https://raw.githubusercontent.com/art-programmer/FloorplanTransformation/master/README.md
- LIFULL HOME'S: https://www.nii.ac.jp/dsc/idr/en/lifull/documents/lifull_homes-policy.html
- Raster-to-Graph: https://raw.githubusercontent.com/HSZVIS/Raster-to-Graph/main/LICENSE
- Raster2Seq: https://arxiv.org/abs/2602.09016, https://huggingface.co/haopt/Raster2Seq, https://raw.githubusercontent.com/Cornell-VAILab/Raster2Seq/master/LICENSE
- PolyRoom: https://raw.githubusercontent.com/3dv-casia/PolyRoom/main/README.md
- FRI-Net: https://arxiv.org/abs/2407.10687
- MuraNet: https://arxiv.org/abs/2309.00348
- Hugging Face floor-plan models:
  - https://huggingface.co/hallelu/floorplan-segmentation
  - https://huggingface.co/phungpx/RMBG-1.4-wall-segmentation-cubicassa
  - https://huggingface.co/briaai/RMBG-1.4
  - https://huggingface.co/OsamaMo/2dplan2strct
- RF-DETR and Ultralytics:
  - https://raw.githubusercontent.com/roboflow/rf-detr/develop/LICENSE
  - https://www.ultralytics.com/license
- fpvec-lab: https://arxiv.org/abs/2608.25608, https://raw.githubusercontent.com/Cyprinus12138/fpvec-lab/main/README.md
- ResPlan: https://raw.githubusercontent.com/m-agour/ResPlan/main/LICENSE
- Swiss Dwellings: https://zenodo.org/records/7070952
- MSD: https://data.4tu.nl/datasets/e1d89cb5-6872-48fc-be63-aadd687ee6f9 (offline when checked)
- FloorPlanCAD: https://floorplancad.github.io/
- MLStructFP: https://raw.githubusercontent.com/MLSTRUCT/MLStructFP/master/README.rst

## Publisher documents (identified by URL and hash only; bytes from the 005C cache)

- https://www.dobredomy.pl/dd_files/Image/projekty/asterVIII/Pliki%20do%20pobrania/asterVIII_pk.pdf — `14189ed5b513d52025320a1a0918edabfcb2353ec9d38a7904e0c40366dc511c`
- https://www.dobredomy.pl/dd_files/Image/projekty/asterVIII/Pliki%20do%20pobrania/asterVIII_pkl.pdf — `6cc483dfc3c14934101bbfcecbe15f3e47ee498315ab0ef31ba47247ad4763b6`
- https://www.dobredomy.pl/dd_files/Image/projekty/galaktykaI/Pliki%20do%20pobrania/galaktykaI_pk.pdf — `149b0799150a60ed1424bbd4d80b3ee9cd92dba0e8995c2441415a94befd4e20`
