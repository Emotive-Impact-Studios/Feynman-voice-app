// AVAudioEngine reports some mistakes (such as playing while the engine has
// just been stopped by iOS) by raising an Objective-C exception, which Swift
// cannot catch and which closes the app. This runs a block and turns any such
// exception into an ordinary Swift error instead.
#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface PhononCatch : NSObject
+ (BOOL)run:(NS_NOESCAPE void (^)(void))block error:(NSError *_Nullable *_Nullable)error;
@end

NS_ASSUME_NONNULL_END
