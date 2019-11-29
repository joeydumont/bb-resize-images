// Create clients outside of the handler


// Create a client to read objects from S3
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    signatureVersion: 'v4'
});
const s3s = require('s3-streams')

// Libraries for image resize.
const util = require('util');
const stream = require('stream');
const sharp = require('sharp');


AWS.config.logger = console.log

// Function to create a read stream to an S3 object.
const readStreamFromS3 = ({Bucket, Key}) => {
    //return s3.getObject({Bucket, Key}).createReadStream();
    return s3s.ReadStream(s3, {
        Bucket: Bucket,
        Key: Key,
    })
};

// Function to create a write stream to S3.
const writeStreamToS3 = ({Bucket, Key}) => {
    const pass = new stream.PassThrough();
    //return {
    //    writeStream: pass,
    //    uploadFinished: s3.upload({
    //        Body: pass,
    //        Bucket,
    //        ContentType: 'image/jpeg',
    //        Key
    //    }).promise()
    //};
    return s3s.WriteStream(s3, {
        Bucket: Bucket,
        Key : Key,
        ContentType: 'image/jpeg',
    })
};

// Resize image stream (sharp).
const resizeStream = ({width, height}) => {
    return sharp()
        .resize(width, height)
        .max()
        .toFormat('jpeg');
};

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
            const fileExt = record.s3.object.key.split('.').pop();
            const splitKey = record.s3.object.key.split('/');
            const prefix = splitKey.splice(-1, 0, "orig");
            const newKey = splitKey.join('/');

            // Show keys and stuff.
            console.log('File extension: ' + fileExt);
            console.log('Split key:' + splitKey);
            //console.log('prefix:' + prefix);
            console.log('newKey: ' + newKey);
            console.log('params', {...params})
            console.log('params', {...params})


            // Copy the object to another location.
            console.log('Defining read stream.')
            const pipeline = util.promisify(stream.pipeline)
            const readStreamOrig = readStreamFromS3(params);
            //const {
            //    writeStreamOrig,
            //    uploadFinishedOrig
            //} = writeStreamToS3({Bucket: params[0], Key: newKey})

            console.log('Defining write stream.')
            const writeStreamOrig = writeStreamToS3({Bucket: params[0], Key: newKey})

            console.log('Initiating the pipe')
            //readStreamOrig
            //    .pipe(writeStreamOrig);
            await (readStreamOrig, writeStreamOrig)

            //const uploadedData = await uploadFinishedOrig;

            //console.log('Image was reuploaded', {
            //    ...uploadedData
            //});

            // Resize the image and overwrite the original upload.
            console.log('Defining read stream for resize')
            const pipelineResize = util.promisify(stream.pipeline)
            const readStream = readStreamFromS3({Bucket: params[0], Key: newKey});
            console.log('Defining resize stream')
            const resizeStreamVar = resizeStream({width: 500, height: 500});
            //const {
            //    writeStream,
            //    uploadFinished
            //} = writeStreamToS3(params);
            console.log('Defining write stream for resize')
            console.log('params', {...params})
            const writeStream = writeStreamToS3(params);

            // Trigger the stream.
            //console.log('Trigger resize stream')
            //readStream
            //    .pipe(resizeStreamVar)
            //    .pipe(writeStream);
            await pipelineResize(readStream, resizeStreamVar, writeStream)

            //const uploadedDataResized = await uploadFinished;

            //console.log('Image was resized:', {
            //    ...uploadedDataResized
            //});

        } catch (error) {
            console.log('Error calling S3 getObject: ' + error);
            console.error('Error calling S3 getObject:' + error);
            throw error;
        }
    });

    await Promise.all(getObjectRequests);
};
