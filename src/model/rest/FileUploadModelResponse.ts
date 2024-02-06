import {Description, Nullable, Property} from "@tsed/schema";
import {FileUploadModel} from "../db/FileUpload.model.js";
import {Builder} from "builder-pattern";
import {ObjectUtils} from "../../utils/Utils.js";

export class FileUploadModelResponse {

    @Property()
    @Description("Used for file info and deleting")
    public token: string;

    @Property()
    @Description("Location of the uploaded file")
    public url: string;

    @Property()
    @Description("How long this file will exist for")
    @Nullable(Number, String)
    public retentionPeriod: string | number | null = null;

    public static fromModel(fileUploadModel: FileUploadModel, baseUrl: string, format = false): FileUploadModelResponse {
        const builder = Builder(FileUploadModelResponse)
            .token(fileUploadModel.token)
            .url(FileUploadModelResponse.getUrl(fileUploadModel, baseUrl));
        if (format) {
            builder.retentionPeriod(ObjectUtils.timeToHuman(fileUploadModel.expiresIn));
        } else {
            builder.retentionPeriod(fileUploadModel.expiresIn);
        }
        return builder.build();
    }

    private static getUrl(fileUploadModel: FileUploadModel, baseUrl: string): string {
        if (fileUploadModel.settings?.hideFilename || !fileUploadModel.originalFileName) {
            return `${baseUrl}/f/${fileUploadModel.fullFileNameOnSystem}`;
        }
        // filename might still contain an extension from legacy uploads
        return `${baseUrl}/f/${fileUploadModel.fileName.split(".").shift()}/${fileUploadModel.originalFileName}`;
    }
}
