# Hand-written Makefile derived from Projects/premake4.lua.
# Builds GWEN core (static), UnitTest (static), the SFML2 renderer (static),
# and the SFML2 sample executable. Targets macOS arm64 with sfml@2 from Homebrew.

GWEN_ROOT   := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
SFML_PREFIX ?= /opt/homebrew/opt/sfml@2

CXX      ?= clang++
AR       ?= ar
CXXSTD   ?= -std=c++14

CXXFLAGS := $(CXXSTD) -O2 -fPIC \
            -DGWEN_COMPILE_STATIC \
            -DGL_SILENCE_DEPRECATION \
            -I$(GWEN_ROOT)/include \
            -isystem $(SFML_PREFIX)/include \
            -Wno-deprecated-declarations \
            -Wno-deprecated-register \
            -Wno-register \
            -Wno-unused-parameter \
            -Wno-writable-strings

LDFLAGS  := -L$(SFML_PREFIX)/lib \
            -Wl,-rpath,$(SFML_PREFIX)/lib \
            -lsfml-graphics -lsfml-window -lsfml-system \
            -framework OpenGL -framework Cocoa

BUILD := $(GWEN_ROOT)/build
BIN   := $(GWEN_ROOT)/bin

# --- GWEN core static lib (skip Win32 + Allegro platform impls; keep Null) ---
GWEN_SRC := $(filter-out \
              $(GWEN_ROOT)/src/Platforms/Windows.cpp \
              $(GWEN_ROOT)/src/Platforms/AllegroPlatform.cpp, \
              $(shell find $(GWEN_ROOT)/src -name '*.cpp'))
GWEN_OBJ := $(patsubst $(GWEN_ROOT)/%.cpp,$(BUILD)/%.o,$(GWEN_SRC))

# --- UnitTest static lib ---
UT_SRC := $(shell find $(GWEN_ROOT)/UnitTest -name '*.cpp')
UT_OBJ := $(patsubst $(GWEN_ROOT)/%.cpp,$(BUILD)/%.o,$(UT_SRC))

# --- SFML2 renderer static lib ---
RENDERER_SRC := $(GWEN_ROOT)/Renderers/SFML2/SFML2.cpp
RENDERER_OBJ := $(patsubst $(GWEN_ROOT)/%.cpp,$(BUILD)/%.o,$(RENDERER_SRC))

# --- SFML2 sample exe ---
SAMPLE_SRC := $(GWEN_ROOT)/Samples/SFML2/SFML2.cpp
SAMPLE_OBJ := $(patsubst $(GWEN_ROOT)/%.cpp,$(BUILD)/%.o,$(SAMPLE_SRC))

LIB_GWEN     := $(BUILD)/libgwen.a
LIB_UT       := $(BUILD)/libgwen-unittest.a
LIB_RENDERER := $(BUILD)/libgwen-renderer-sfml2.a
EXE          := $(BIN)/SFML2Sample

all: $(EXE)

$(BUILD)/%.o: $(GWEN_ROOT)/%.cpp
	@mkdir -p $(dir $@)
	$(CXX) $(CXXFLAGS) -MMD -MP -c -o $@ $<

$(LIB_GWEN): $(GWEN_OBJ)
	@mkdir -p $(dir $@)
	$(AR) rcs $@ $^

$(LIB_UT): $(UT_OBJ)
	@mkdir -p $(dir $@)
	$(AR) rcs $@ $^

$(LIB_RENDERER): $(RENDERER_OBJ)
	@mkdir -p $(dir $@)
	$(AR) rcs $@ $^

$(EXE): $(SAMPLE_OBJ) $(LIB_UT) $(LIB_RENDERER) $(LIB_GWEN)
	@mkdir -p $(dir $@)
	$(CXX) -o $@ $(SAMPLE_OBJ) $(LIB_UT) $(LIB_RENDERER) $(LIB_GWEN) $(LDFLAGS)

run: $(EXE)
	cd $(BIN) && ./SFML2Sample

clean:
	rm -rf $(BUILD)
	rm -f $(EXE)

.PHONY: all clean run

-include $(GWEN_OBJ:.o=.d) $(UT_OBJ:.o=.d) $(RENDERER_OBJ:.o=.d) $(SAMPLE_OBJ:.o=.d)
