// elsed_cli — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Not production code.
//
// Drives the upstream ELSED library (iago-suarez/ELSED @ 1878213b, Apache-2.0) on one grayscale PNG and prints its
// salient segments. It mirrors upstream src/PYAPI.cpp `compute_elsed` parameter for parameter (the Python binding at
// the pinned commit vendors pybind11 2.8.1, which does not compile against CPython 3.11; the library itself is built
// unchanged). Output: one line per segment, "x0 y0 x1 y1 salience", then "#ms <milliseconds>" for detection alone.
//
// usage: elsed_cli <image.png> [sigma gradientThreshold minLineLen lineFitErrThreshold pxToSegmentDistTh validationTh validate treatJunctions]
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <opencv2/opencv.hpp>
#include <ELSED.h>

int main(int argc, char **argv) {
  if (argc < 2) { std::fprintf(stderr, "usage: elsed_cli <image.png> [params]\n"); return 2; }
  cv::Mat img = cv::imread(argv[1], cv::IMREAD_GRAYSCALE);
  if (img.empty()) { std::fprintf(stderr, "cannot read %s\n", argv[1]); return 3; }
  upm::ELSEDParams params;
  float sigma = argc > 2 ? std::atof(argv[2]) : 1.0f;
  params.sigma = sigma;
  params.ksize = cvRound(sigma * 3 * 2 + 1) | 1;  // as PYAPI.cpp
  params.gradientThreshold = argc > 3 ? std::atof(argv[3]) : 30.0f;
  params.minLineLen = argc > 4 ? std::atoi(argv[4]) : 15;
  params.lineFitErrThreshold = argc > 5 ? std::atof(argv[5]) : 0.2;
  params.pxToSegmentDistTh = argc > 6 ? std::atof(argv[6]) : 1.5;
  params.validationTh = argc > 7 ? std::atof(argv[7]) : 0.15;
  params.validate = argc > 8 ? std::atoi(argv[8]) != 0 : true;
  params.treatJunctions = argc > 9 ? std::atoi(argv[9]) != 0 : true;
  auto t0 = std::chrono::steady_clock::now();
  upm::ELSED elsed(params);
  upm::SalientSegments segs = elsed.detectSalient(img);
  auto t1 = std::chrono::steady_clock::now();
  for (const auto &s : segs) std::printf("%.3f %.3f %.3f %.3f %.4f\n", s.segment[0], s.segment[1], s.segment[2], s.segment[3], s.salience);
  std::printf("#ms %.3f\n", std::chrono::duration<double, std::milli>(t1 - t0).count());
  return 0;
}
