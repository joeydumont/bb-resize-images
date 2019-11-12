// Create clients outside of the handler

// Create a client to read objects from S3
const AWS = require('aws-sdk');
const s3 = new AWS.S3();

// Libraries for image resize.
const stream = require('stream')
const sharp = require('sharp')

// Function to create a read stream to an S3 object.
const readStreamFromS3 = ({Bucket, Key}) => {
    return s3.getObject({Bucket, Key}).createReadStream()
}

// Function to create a write stream to S3.
const writeStreamToS3 = ({Bucket, Key, ImageType}) => {
    const pass = new stream.PassThrough()
    return {
        writeStream: pass,
        uploadFinished: s3.upload({
            Body: pass,
            Bucket,
            ContentType: ImageType,
            Key
        }).promise()
    }
}

// Get size from stream (sharp)
const getSizeFromStream = () => {
    const pass = new stream.PassThrough()
    const metadata = sharp.metadata()
    return {
        writeStream: pass,
        width: metadata.width,
        height: metadata.height
    }
}

// Resize image stream (sharp).
const resizeStream = ({width, height, ImageFmt}) => {
    return sharp()
        .resize(width, height)
        .toFormat(ImageFmt)
}

/**
  * A Lambda function that logs the payload received from S3.
  */
exports.resizeImagesHandler = async (event, context) => {
    const getObjectRequests = event.Records.map(async (record) => {
        const params = {
            Bucket: record.s3.bucket.name,
            Key: record.s3.object.key,
        };

        try {
            // First, copy the original to a new file.
            fileExt = record.s3.object.key.split('.').pop()
            splitKey = record.s3.object.key.split('/')
            prefix = splitKey.splice(splitKey.len()-1, 0, "orig")
            newKey = prefix.join('/')
            const readStreamOrig = readStreamFromS3(params)
            const {
                passThroughStream,
                origWidth,
                origHeight
            } = getSizeFromStream()
            const {
                writeStreamOrig,
                uploadFinishedOrig
            } = writeStreamToS3(Bucket: params[0], Key: newKey)

            readStreamOrig
                .pipe(passThroughStream)
                .pipe(writeStreamOrig)

            const uploadedData = await uploadFinishedOrig

            // Have to determine the original width and height.
            // Can that be done through a stream, or does it have to be done
            // before processing?
            // Compute ratio of width/height. width will always be 500 pixels in the end.
            const ratio = origWidth / origHeight
            const readSTream = readStreamFromS3(Bucket: params[0], Key: newKey )
            const resizeStream = resizeStream({500, 500/ratio})
            const {
                writeStream,
                uploadFinished
            } = writeStreamToS3({Bucket: params[0], Key: params[1]})

            // Trigger the stream.
            readStream
                .pipe(resizeStream)
                .pipe(writeStream)

            const uploadedData = await uploadFinished

            console.log('Image was resized:', {
                ...uploadedData
            })

        } catch (error) {
            console.error('Error calling S3 getObject:', error);
            throw error;
        }
    });

    await Promise.all(getObjectRequests);
};
