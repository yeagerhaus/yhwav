#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(MetadataModule, NSObject)

RCT_EXTERN_METHOD(getMetadata:(NSString *)path
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end
