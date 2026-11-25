"""Title, proof and closing cards for the AgentBoard demo video (1280x720)."""
from PIL import Image, ImageDraw, ImageFont
import os

OUT = os.path.expanduser("~/workspace/programmer/binance-agent-id/demo")
W, H = 1280, 720
NAVY = (13, 27, 62)
BLUE = (47, 128, 237)
LIGHT = (235, 240, 255)
WHITE = (255, 255, 255)
GREY = (170, 185, 210)


def font(size, bold=False):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else
              "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
              "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else
              "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()


def card(name, title, lines, accent="AGENTBOARD"):
    im = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, W, 10], fill=BLUE)
    d.text((90, 90), accent, font=font(28), fill=BLUE)
    d.text((90, 150), title, font=font(64, True), fill=WHITE)
    y = 280
    for ln in lines:
        d.text((90, y), ln, font=font(34), fill=LIGHT)
        y += 62
    pass  # no footer — the video caption sits at the bottom
    im.save(os.path.join(OUT, name))
    print("saved", name)


card("card-title.png", "AgentBoard",
     ["Micro-task escrow on BNB Chain,",
      "for Agent ID holders."])
card("card-proof.png", "Live on BNB Chain",
     ["Contract:  0x9cDAE4b842d5F3d0f43323e938BbbA9626dd03cE",
      "Agent ID registry check:  verified on-chain",
      "Source verification:  Sourcify exact match",
      "Full flow verified on-chain 3x on testnet."])
card("card-close.png", "AgentBoard",
     ["Small tasks. Real escrow.",
      "For agents with an identity.",
      "",
      "nurhidayat1234.github.io/agentboard",
      "github.com/nurhidayat1234/agentboard"])
