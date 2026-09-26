# The JNI bridge between the app and its embedded Node runtime (nodejs-mobile
# 18.20.4, apps/android/tools/fetch-nodejs-mobile.mjs). One job: hand an
# argument vector to node::Start and return its exit code. Everything the
# local analyzer does is JavaScript — the production analyzer bundle — so
# nothing of the pipeline is compiled here.
#
# An ABI with no fetched libnode.so (armeabi-v7a in this build) gets no bridge
# at all; the app then reports the local analyzer as unavailable on that
# device instead of failing to load.
cmake_minimum_required(VERSION 3.22.1)
project(buildapp_node_bridge LANGUAGES CXX)

if(NOT DEFINED LIBNODE_DIR)
  message(FATAL_ERROR "LIBNODE_DIR is not set (app/build.gradle.kts passes it)")
endif()

set(LIBNODE "${LIBNODE_DIR}/${ANDROID_ABI}/libnode.so")
if(NOT EXISTS "${LIBNODE}")
  message(STATUS "no embedded Node runtime for ${ANDROID_ABI}: the local analyzer is not built for this ABI")
  return()
endif()

add_library(node SHARED IMPORTED)
set_target_properties(node PROPERTIES IMPORTED_LOCATION "${LIBNODE}")

add_library(buildapp_node_bridge SHARED node_bridge.cpp)
target_compile_features(buildapp_node_bridge PRIVATE cxx_std_17)
target_compile_options(buildapp_node_bridge PRIVATE -Wall -Wextra -Werror)
target_link_libraries(buildapp_node_bridge node log)
