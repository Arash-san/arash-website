import Image from "next/image";
import { DotPattern } from "@/components/ui/dot-pattern";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header Section */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Dot Pattern Background */}
        <DotPattern
          className={cn(
            "[mask-image:radial-gradient(800px_circle_at_center,white,transparent)]",
          )}
          width={20}
          height={20}
          cx={1}
          cy={1}
          cr={1}
        />
        
        {/* Main Content */}
        <div className="relative z-10 container mx-auto px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-center max-w-4xl mx-auto">
            {/* Left Side - Portrait Image */}
            <div className="flex justify-center lg:justify-start">
              <div className="relative w-80 h-[420px] rounded-lg overflow-hidden shadow-2xl bg-gray-100">
                <Image
                  src="/portrait.jpg"
                  alt="Arash Portrait"
                  fill
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            
            {/* Right Side - Text Content */}
            <div className="space-y-6 text-center lg:text-left">
              {/* Main Greeting */}
              <div className="space-y-2">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold">
                  <span className="text-gray-600">Hi! I'm </span>
                  <span className="text-black">Arash</span>
                  <span className="text-gray-600"> :)</span>
                </h1>
              </div>
              
              {/* Lorem Ipsum Text */}
              <div className="space-y-4 max-w-lg">
                <p className="text-lg text-gray-700 leading-relaxed">
                  Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 