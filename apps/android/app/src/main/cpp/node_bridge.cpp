// The JNI bridge to the embedded Node runtime.
//
// nodejs-mobile builds Node.js as a shared library, libnode.so, whose entry
// point is node::Start(argc, argv) — Node's own main. This file declares that
// one function (its mangled name is exported by libnode.so) instead of
// including Node's headers, and adds the least an Android process needs
// around it:
//
//  - the environment the program should see, set before Node reads it;
//  - argv in ONE contiguous block, which libuv requires (it rewrites the
//    process title in place over the argument memory);
//  - stdout and stderr forwarded to logcat, so an uncaught error in the
//    JavaScript is visible to a developer. The program's own events do not
//    use them: they go over a pipe the Kotlin side created.
//
// node::Start may run once per process. The Kotlin side guarantees that by
// running each job in a fresh `:analyzer` process.
#include <jni.h>

#include <android/log.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#include <string>
#include <vector>

namespace node {
int Start(int argc, char* argv[]);
}

namespace {

const char* const kTag = "BuildAppNode";

int g_stdout_pipe[2] = {-1, -1};
int g_stderr_pipe[2] = {-1, -1};

void* forward(void* arg) {
  const int priority = (arg == &g_stderr_pipe) ? ANDROID_LOG_WARN : ANDROID_LOG_INFO;
  const int fd = static_cast<int*>(arg)[0];
  char buffer[1024];
  ssize_t n;
  while ((n = read(fd, buffer, sizeof buffer - 1)) > 0) {
    if (buffer[n - 1] == '\n') --n;
    buffer[n] = '\0';
    __android_log_write(priority, kTag, buffer);
  }
  return nullptr;
}

void forward_output_to_logcat() {
  setvbuf(stdout, nullptr, _IONBF, 0);
  setvbuf(stderr, nullptr, _IONBF, 0);
  if (pipe(g_stdout_pipe) == 0 && pipe(g_stderr_pipe) == 0) {
    dup2(g_stdout_pipe[1], STDOUT_FILENO);
    dup2(g_stderr_pipe[1], STDERR_FILENO);
    pthread_t out_thread;
    pthread_t err_thread;
    if (pthread_create(&out_thread, nullptr, forward, &g_stdout_pipe) == 0) pthread_detach(out_thread);
    if (pthread_create(&err_thread, nullptr, forward, &g_stderr_pipe) == 0) pthread_detach(err_thread);
  } else {
    __android_log_write(ANDROID_LOG_WARN, kTag, "could not forward stdout/stderr to logcat");
  }
}

std::string utf8(JNIEnv* env, jstring value) {
  const char* chars = env->GetStringUTFChars(value, nullptr);
  std::string out(chars ? chars : "");
  if (chars) env->ReleaseStringUTFChars(value, chars);
  return out;
}

std::vector<std::string> strings(JNIEnv* env, jobjectArray array) {
  std::vector<std::string> out;
  const jsize count = array ? env->GetArrayLength(array) : 0;
  out.reserve(static_cast<size_t>(count));
  for (jsize i = 0; i < count; ++i) {
    auto element = static_cast<jstring>(env->GetObjectArrayElement(array, i));
    out.push_back(utf8(env, element));
    env->DeleteLocalRef(element);
  }
  return out;
}

}  // namespace

extern "C" JNIEXPORT jint JNICALL
Java_com_buildplan_preview_analyzer_local_NodeRuntime_nativeStart(JNIEnv* env, jclass, jobjectArray arguments, jobjectArray environment) {
  // "KEY=VALUE" pairs, applied before Node starts reading its environment.
  for (const std::string& pair : strings(env, environment)) {
    const size_t eq = pair.find('=');
    if (eq == std::string::npos || eq == 0) continue;
    setenv(pair.substr(0, eq).c_str(), pair.substr(eq + 1).c_str(), 1);
  }

  const std::vector<std::string> args = strings(env, arguments);
  if (args.empty()) return -1;
  size_t total = 0;
  for (const std::string& a : args) total += a.size() + 1;
  // Deliberately never freed: Node keeps pointers into argv for the life of the process.
  char* block = static_cast<char*>(calloc(total, 1));
  if (!block) return -1;
  std::vector<char*> argv;
  argv.reserve(args.size() + 1);
  char* at = block;
  for (const std::string& a : args) {
    memcpy(at, a.c_str(), a.size() + 1);
    argv.push_back(at);
    at += a.size() + 1;
  }
  argv.push_back(nullptr);

  forward_output_to_logcat();
  return static_cast<jint>(node::Start(static_cast<int>(args.size()), argv.data()));
}
