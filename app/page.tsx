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
           <div className="flex flex-col lg:flex-row items-center justify-center gap-13 max-w-4xl mx-auto">
                         {/* Left Side - Portrait Image */}
             <div className="flex-shrink-0">
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
             <div className="space-y-3 text-center lg:text-left lg:ml-4">
              {/* Main Greeting */}
              <div className="space-y-2">
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold">
                  <span className="text-gray-600">Hi! I'm </span>
                  <span className="text-black">Arash</span>
                  <span className="text-gray-600"> :)</span>
                </h1>
              </div>
              
              {/* Lorem Ipsum Text */}
              <div className="space-y-2 max-w-lg">
                <p className="text-lg text-gray-700 leading-relaxed">
                  Welcome to my personal website! 
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                  Currently, I'm a second year PhD student in electrical and computer engineering at the <a href="https://www.ou.edu/" className="text-[#DC143C] underline" target="_blank" rel="noopener noreferrer">University Of Oklahoma.</a>
                </p>
                <p className="text-lg text-gray-700 leading-relaxed">
                  In my studies, I'm focusing on the utilization of Large Language Models (LLMs) in different domans, and also working on the interpretibility side of them.
                </p>
                <p className="text-lg text-gray-700 leading-relaxed font-bold">You can scroll to see more!</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
